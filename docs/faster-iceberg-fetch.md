# Faster iceberg fetch — research notes

*Written 2026-10-14/15 as a research pass (no code changed). Note: igloo has no existing
docs or research-notes convention — this `docs/` directory is new and could become the
home for future notes of this kind.*

## 1. Question & scope

Michael asked: *"figure out ways to speed up my fetch from iceberg"* — the round trip
the portfolio site experiences when getting commit/language stats. Scope of this
investigation:

- The full hop chain: **browser → igloo `/api/commits.json` (Astro on Cloudflare) →
  iceberg worker (`https://iceberg.penqguin.com`) → GitHub GraphQL API**.
- Where caching exists in both repos, where TTLs are too short or mismatched, what the
  Cloudflare platform (Cache API, Workers Cache, Cache Rules, cron warmers, placement)
  offers, and what actually dominates latency (measured with curl).

Both repos live locally: igloo (`/Users/michaelmaddison/dev/igloo`, deployed at
**https://penqguin.com**, Cloudflare Pages — `wrangler.toml:2` `pages_build_output_dir`,
Astro cloudflare adapter with `platformProxy` at `astro.config.mjs:11–13`) and iceberg
(`/Users/michaelmaddison/dev/iceberg`, Rust worker deployed at
**https://iceberg.penqguin.com**; repo remote confirms igloo deploys from
`github.com/Penqguin/igloo` via Cloudflare's GitHub integration).

## 2. The fetch pipeline today

### Hop 1: browser → igloo route

`src/components/widgets/CommitsWidget.astro` is a client-side widget:

- `CommitsWidget.astro:38–40` — calls the **local** route
  `/api/commits.json?username=penqguin&limit=5&history_limit=70` (comment on line 37:
  "Use local API route instead of direct Iceberg API").
- `CommitsWidget.astro:130–134` — fires on `DOMContentLoaded`; no client-side cache,
  every page load is a fresh network request, and rendering blocks on it.

`src/pages/api/commits.json.ts` is the proxy:

- `commits.json.ts:3` — `export const prerender = false;` → the route **re-executes on
  every request** (never prebuilt).
- `commits.json.ts:6–8` — forwards user-supplied query params (`username`, `limit`,
  `history_limit`) straight through (with defaults). Anyone can drive the proxy with
  arbitrary params; see Risks in §5-O7.
- `commits.json.ts:11–14` — a single `fetch` to iceberg, **with no timeout/AbortSignal
  and no cache of its own**. The only caching is on the response headers it returns:
  `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300` (`commits.json.ts:25`).
- `commits.json.ts:28–37` — on any failure it returns HTTP 500 with an empty
  `commits`/`languages` body (the widget shows the fallback message).

### Hop 2: igloo worker → iceberg worker

iceberg's `wrangler.toml:9–12` defines a cron warmer every 5 minutes (comment: "Warmer
skips entries that already exist (TTL 300s)"). The request path inside iceberg:

- `src/lib.rs:201–207` — `/v2/commits/latest` routes with `CachePolicy { ttl_secs: 300 }`.
- `src/pipeline.rs:277–326` (`run_pipeline_steps`) — parse/validate params → resolve auth
  (whitelisted username uses the system `GITHUB_TOKEN`, `pipeline.rs:358–386`) → derive
  cache key and check cache → on miss run the handler.
- `src/cache.rs:17–22` — `cache_key()` embeds `limit`, `history`, `langs` into a
  synthetic URL used with the Workers **Cache API** (`cache.rs:76–86`,
  `WorkersCache` → `caches.default`). Per Cloudflare docs the Cache API is
  **data-center-local**: content does not replicate to other colos
  (https://developers.cloudflare.com/workers/runtime-apis/cache/).
- On HIT the pipeline unfreezes and stamps `X-Cache: HIT` (`pipeline.rs:321–326`); on
  MISS (`pipeline.rs:332–352`) it builds the response with
  `Cache-Control: s-maxage={ttl}` → **`s-maxage=300`** (`pipeline.rs:167–172`) and puts
  it into the Cache API.
- The handler `get_commits_list` (`src/github/domain.rs:24–89`) is **one single GraphQL
  request** to `https://api.github.com/graphql` (`domain.rs:33–81`) fetching
  `limit` repos × `history_limit` commits × languages in a single round trip. There is
  **no internal sequencing to parallelize** — the design is already coalesced.
- Timeout/retry: default whole-cycle budget 15 s, max 30 s (`pipeline.rs:16–17,
  42–47`); retries with exponential backoff on rate-limit inside that budget
  (`src/github/client.rs:139–183`); per-attempt timeout enforced by racing a
  `Delay` against the fetch (`client.rs:71–79`).

### Hop 3: iceberg → GitHub GraphQL

One authenticated POST per miss, counted in GraphQL points (measured `x-query-cost: 0`
on the live response body headers; docs: 5,000 points/hour per user token —
https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api).
GitHub terminates requests taking >10 s (same doc, "Timeouts"), which makes iceberg's
15 s budget a sane upper bound.

### The cron warmer does **not** warm igloo's cache entry

The warmer (`lib.rs:126–168`) iterates whitelisted users and warms with
`QueryParams { limit: 10, history_limit: 10, language_limit: 3 }` (`lib.rs:139–142`),
then derives the key via the same `cache_key()`. But **igloo requests
`limit=5&history_limit=70`** (default `language_limit=3`), so its key is
`...?limit=5&history=70&langs=3` — a **different cache key** from the warmer's
`...?limit=10&history=10&langs=3`. ADR-0001's claim that "the cron warmer … plus a 300s
edge TTL keeps whitelisted profiles continuously warm"
(`docs/adr/0001-request-cache-stays-on-cache-api.md:19–21`) is true only for the
warmer's own parameters, **not** for the production igloo query. Every miss igloo
experiences is filled by real traffic, and expires again after 300 s.

(Also worth noting: Cache API entries are per-colo, and cron triggers run in *one*
colo wherever Cloudflare schedules them — https://developers.cloudflare.com/workers/configuration/cron-triggers/ —
so a warmer can't fill a world-wide cache by itself, even with matching params.)

### Where caches exist today (summary)

| Layer | Exists? | TTL | Citation |
| --- | --- | --- | --- |
| Browser cache of `/api/commits.json` | ✗ served `cf-cache-status: DYNAMIC`, no browser `max-age` | — | measured (§3) |
| Any edge cache in front of igloo's route | ✗ **never cached** despite `s-maxage=3600` | — | measured (§3) |
| igloo in-worker Cache API | ✗ route does no cache work | — | `commits.json.ts:22–27` |
| iceberg in-worker Cache API | ✓ per-colo | 300 s | `cache.rs:76–86`, `pipeline.rs:170` |
| Edge/zone cache on `iceberg.penqguin.com` | ✓ observed (`cf-cache-status: HIT`) | 300 s (s-maxage) / browser max-age 14400 | measured (§3); exact rule not visible from outside |
| Cron warmer | ✓ but **wrong key** for igloo | every 5 min | `lib.rs:139–142`, `wrangler.toml:9–12` |

## 3. Measurements

All measured from a single machine (YYZ colo per `cf-ray`), 2026-10-15 ~00:05–00:10 UTC,
≤7 external requests total (deliberately not hammering). Iceberg response body is
**3175 bytes** in every request.

**iceberg `/v2/commits/latest?username=penqguin&limit=5&history_limit=70` (igloo's exact URL):**

| run | ttfb | total | notes |
| --- | --- | --- | --- |
| 1 (fresh/miss) | 3.690 s | **3.696 s** | cold — full GitHub GraphQL fetch |
| 2 (warm) | 0.107 s | **0.107 s** | cache hit |
| 3 (warm) | 0.219 s | **0.222 s** | cache hit |
| header dump | — | — | `cf-cache-status: HIT`, `x-cache: HIT`, `age: 14`,
  `cache-control: max-age=14400, s-maxage=300`, `content-length: 3175` |

Note: iceberg's own code only emits `s-maxage=300` (`pipeline.rs:170`); the extra
`max-age=14400` and the `CF-Cache-Status` on the public URL indicate the zone/edge is
caching these responses in front of the worker (config not visible from outside).

**igloo live site (https://penqguin.com):**

| request | ttfb/total | notes |
| --- | --- | --- |
| `GET /` homepage | 0.291 s | 200 |
| `GET /api/commits.json?username=penqguin&limit=5&history_limit=70` | **0.205 s** | 200, 3175 B,
  **`cf-cache-status: DYNAMIC`** — never edge-cached despite `Cache-Control: public,
  s-maxage=3600, stale-while-revalidate=300` on the response |

**Local dev** (`localhost:4321/api/commits.json`, Astro dev + platformProxy): 0.125 s,
3175 B — sanity check only, not representative of production cold path.

**Interpretation (measured + estimate):**

- The warm path is fast end-to-end: **0.10–0.22 s** at iceberg, **0.21 s** through the
  igloo proxy. The proxy hop itself adds only ~0.05–0.10 s (estimate comparing warm
  numbers on the same colo).
- The cold path costs **3.69 s** — and with `s-maxage=300` + a warm broken for igloo's
  key, *someone* pays 3.69 s roughly every 5 minutes, whenever the edge copy expires.
- Attribution (estimate): DNS+TLS to iceberg measured only 0.030–0.096 s, so
  ~3.6 s of the cold run is iceberg's worker + the GitHub GraphQL execution (the
  GitHub-side query processing dominates; GitHub documents >10 s as its own timeout).

## 4. Findings: where the time goes (ranked)

1. **Cold misses into GitHub GraphQL dominate (~3.7 s).** Everything else on the chain
   is ≪100 ms at warm. The cold cost is `pipeline.rs:332` → `domain.rs:81` → one
   GraphQL query over 5 repos × 70 commits × languages (`domain.rs:71–78`), plus worker
   startup. Measured: run1 = 3.696 s vs warm 0.107 s.
2. **igloo's route is never edge-cached** (`cf-cache-status: DYNAMIC`, measured). The
   `s-maxage=3600` header on `commits.json.ts:25` is only advisory for Pages Functions —
   without a Cache Rule, Cloudflare executes the worker (and its iceberg subrequest) on
   **every** visitor page load. Cloudflare's zone Cache Rules decide cacheability for
   responses that would otherwise be DYNAMIC
   (https://developers.cloudflare.com/cache/how-to/cache-rules/settings/ — "Eligible
   for cache" + Edge TTL).
3. **The cron warmer warms the wrong cache key** for production traffic: warmer
   `limit=10&history=10&langs=3` (`lib.rs:139–142`) vs igloo's
   `limit=5&history=70&langs=3` (defaults in `commits.json.ts:7–8` → iceberg v2 parses
   `pipeline.rs:79–96`). The ADR's premise ("keeps whitelisted profiles continuously
   warm", `docs/adr/0001:19–21`) is therefore not realized for the portfolio route.
4. **TTLs are too short for the data's actual rate of change.** Commit stats change
   when Michael pushes code, not every 5 minutes. iceberg pins `ttl_secs: 300`
   (`lib.rs:204`, `pipeline.rs:170`, warmer `lib.rs:156`), so at minimum one visitor
   per 5 min per colo eats the 3.7 s miss (edge-cached copy also expires on 300 s).
5. **Cache API is colo-local and not tiered**; `cache.put/match` will never cover all
   visitor locations, and Cloudflare explicitly recommends `fetch()` for anything that
   should benefit from tiered/global caching
   (https://developers.cloudflare.com/workers/reference/how-the-cache-works/). Also,
   the Cache API does **not** support request collapsing or `stale-while-revalidate` —
   a burst on a fresh key runs the worker once per request
   (https://developers.cloudflare.com/workers/runtime-apis/cache/), which is why the
   measured `cf-cache-status: HIT` at the edge layer is valuable.
6. **Internal parallelization inside iceberg: nothing to gain.** `get_commits_list` is
   already a single coalesced GraphQL round trip (`domain.rs:71–81`); retries are
   budgeted inside a deadline (`client.rs:150–164`). This is good design — leave it.
7. **Payload is not the problem.** Response is 3,175 bytes. `history_limit=70` mainly
   costs *GitHub-side execution time* on misses (node count scales as repos × history —
   https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api),
   not bandwidth to the client.
8. **No timeout on igloo's fetch** (`commits.json.ts:11–14`) — with iceberg's own 15 s
   budget and backoff retries (`client.rs:166–183`), a pathological miss could hold one
   igloo worker for tens of seconds before the 500 fallback fires.

## 5. Speed-up options (ranked: impact × effort)

| # | Option | Impact | Effort | Risk |
| --- | --- | --- | --- | --- |
| O1 | **Cache Rule on penqguin.com**: `/api/commits.json*` → Eligible for cache, Edge TTL "respect origin" (`s-maxage=3600` honored) | Very high — edge serves every visit for up to 1 h **without running either worker** | Trivial — dashboard only, no code | 1 h staleness on portfolio stats; purge needed after pushes; query params go into the cache key by default (fine — only igloo's own query is used) |
| O2 | **Align the warmer with igloo's real query** (igloo sends `limit=5&history_limit=70`, defaults `language_limit=3`) — change `lib.rs:139–142` to `{ limit: 5, history_limit: 70, language_limit: 3 }` (ideally via env vars) | High — after each cron tick, the warmer's GET fills igloo's key fresh, so misses caused by expiry are replaced by warm fetches in the cron's colo | ~1 line + optional env plumbing | Warmer still only fills one colo's Cache API (per-DC cache, docs above); combine with O1/O3 for world-wide coverage |
| O3 | **Raise iceberg TTLs 300 → 3600** (`lib.rs:204` EndpointConfig, warmer `lib.rs:156` and Cron warm-check logic) | High — cold 3.7 s hits drop from ~12×/hour to ~1×/hour; matches igloo's already-declared `s-maxage=3600` | Small (3 values in `lib.rs`; cache put TTL follows response Cache-Control per Cache API docs) | Stats freshness up to 1 h; ADR-0001 would need a revision note |
| O4 | **Client-side staleness in CommitsWidget**: cache the JSON in `localStorage` keyed by query, render immediately, revalidate in background | High for repeat visitors — zero-latency paint, masks even the 3.7 s tail; ~20 lines of JS | Small | Stale-first UX; keep a max-age guard (e.g. serve cached up to 6 h, network when absent) |
| O5 | **Enable Workers Cache on iceberg** (`[cache] enabled = true` + compat date ≥ 2026-10-14): tiered caching + request collapsing in front of the worker, honoring worker-emitted `Cache-Control` | Medium-high on cold-burst resilience; pairs naturally with O3 | Small (config); requires deploy of updated compat date | Newer feature; changes miss behavior of the existing deploy tiering; docs: https://developers.cloudflare.com/workers/cache/ |
| O6 | **Skip the igloo proxy hop** (client hits `iceberg.penqguin.com` directly; iceberg already answers CORS `*` — `lib.rs:60`) | Low — hop costs only ~0.05–0.10 s warm; misses aren't cheaper because the GitHub fetch is identical | Trivial frontend change | Loses igloo's 500-masking/error reshaping (`commits.json.ts:28–37`); couples the site to iceberg's CORS/uptime; params passthrough unchanged |
| O7 | **Harden igloo's fetch**: ground the URL (ignore user-passed `username`), add `AbortSignal.timeout`, cap `history_limit` | Safety/Hygiene — no perceived speed gain, but the current passthrough lets any visitor mint arbitrary iceberg queries (different cache keys + cost) | Small | None |
| O8 | **Smart Placement on iceberg** (`[placement] mode = "smart"`) | Low — cold miss latency is dominated by GitHub-side query execution (measured 3.6 s vs ≤0.1 s network overhead); placement shaves only the RTT fraction | Trivial | May move worker serving to a distant colo for warm requests too |
| O9 | **KV/DO cache of last-good JSON at igloo** | Low given O1+O4; useful only if global persistence across deploys becomes needed (KV is eventually consistent; the ADR explicitly rejected R2 for this same reason at the iceberg layer — `docs/adr/0001:22–24`) | Medium | Extra moving part for little measured benefit |
| O10 | **Trim/paginate `history_limit`** | Low — payload already tiny; only shrinks GitHub execution time on misses; product decision (languages roll-up uses the history window) | Small | Changes language distribution semantics |
| — | Conditional requests (ETag/304) to GitHub | Not applicable — iceberg uses the **GraphQL** API; GitHub's documented ETag/conditional-request mechanism is a REST feature, and GraphQL responses must be parsed to know anything at all (iceberg pins `https://api.github.com/graphql`, `client.rs:14`) | — | — |

Sidebar on O1's reach: the Workers Cache page is explicit that zone-level cache
configuration (Cache Rules etc.) has **no effect** on a *Worker's* own cache — but it
governs whether the response a Worker/Pages Function returns goes through the zone
cache read at all. Today igloo's route reads as `DYNAMIC` (measured), i.e. the zone
cache read applies and finds it non-cacheable; an explicit "Eligible for cache" rule
flips that and, unlike the per-colo Cache API, enjoys tiered caching and request
collapsing (https://developers.cloudflare.com/workers/cache/).

## 6. Recommended shortlist (do these three first)

1. **O1 — Cache Rule on penqguin.com for `/api/commits.json`.** Zero code. Measured
   upside: warm path 0.205 s → edge-cache HIT (expected tens of ms),
   and the 3.7 s cold tail stops touching `page-load` entirely for up to an hour.
   Purge via dashboard after notable pushes if you care.
2. **O3 + O2 — make misses rare and warm: raise iceberg TTL to 3600 s and point the
   cron warmer at igloo's actual query** (`limit=5`, `history_limit=70`, `language_limit=3`).
   Cited bug: warmer currently fills a key no production request uses
   (`lib.rs:139–142` vs `commits.json.ts:6–8`). Together these cut the 3.7 s hits from
   "roughly every 5 minutes" to "roughly once an hour, in one colo at a time".
3. **O4 — stale-while-revalidate on the client** in `CommitsWidget.astro`: read from
   `localStorage`, render instantly, refresh in the background. This is the only way
   to make the very first paint of a repeat visit genuinely instant, and it removes
   the user-visible artifact of iceberg's slow GitHub miss entirely.

(O7 — no timeout / URL hardening — should ride along with any edit made to
`commits.json.ts`; it is hygiene, not speed.)

If you want a bigger platform-level change later rather than right away, O5 (Workers
Cache `[cache] enabled = true` on iceberg, paired with O3) is the cleanest way to get
tiered, collapsed miss handling behind iceberg's own response headers.

## 7. Sources

**Local code (read directly):**

- igloo: `src/pages/api/commits.json.ts` (whole file), `src/components/widgets/CommitsWidget.astro` (whole file), `astro.config.mjs`, `wrangler.toml`, `README.md`, and deploy model via git remote (`github.com/Penqguin/igloo`).
- iceberg: `src/lib.rs`, `src/pipeline.rs`, `src/cache.rs`, `src/shaping.rs` (pure hot path), `src/github/{mod,domain,client,streak,types,tests}.rs`, `benches/performance.rs`, `docs/adr/0001-request-cache-stays-on-cache-api.md`, `docs/specs/review-fixes.md` (section headers), `docs/tickets/INDEX.md` (listing), `wrangler.toml`.

**Official Cloudflare docs consulted:**

- Cache API (s-maxage handling, `stale-while-revalidate` unsupported, per-DC locality, no request collapsing): https://developers.cloudflare.com/workers/runtime-apis/cache/
- Workers Cache (`[cache] enabled`, tiering, request collapsing, RFC 9111 semantics, worker-level cache key noting zone-rules have no effect on *that* cache): https://developers.cloudflare.com/workers/cache/
- How the Cache works (fetch vs Cache API, zone reads/purges, recommended `fetch()` for middleware-ish subrequests): https://developers.cloudflare.com/workers/reference/how-the-cache-works/
- Cache Rules settings (Eligible for cache, Edge TTL "respect origin"/override, custom cache key): https://developers.cloudflare.com/cache/how-to/cache-rules/settings/
- Cron Triggers (supported expressions, scheduling, note that crons run where Cloudflare decides): https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Placement / Smart Placement (https://developers.cloudflare.com/workers/configuration/placement/)

**Official GitHub docs consulted:**

- GraphQL rate limits & query limits (points formula, node limits, >10 s timeouts):
  https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- (REST-only conditional requests via ETag, referenced for the "not applicable" option; iceberg pins the GraphQL endpoint, so this channel isn't the lever.)

**Measured facts (this document, §3):** iceberg endpoint cold/warm curl timings and
headers, live `penqguin.com/api/commits.json` timing and headers (hops as tabulated).
Approximate quantification distinguishing measured vs estimated values is flagged
inline (`estimate`) wherever it appears.
