// Shared iceberg plumbing for the two places that need the latest commits:
//  - /api/commits.json (the proxy route the client widget revalidates through)
//  - index.astro (server-side seed for instant first paint)
//
// First-paint seeding: the latest response is mirrored into the SESSION KV
// namespace under igloo:commits:snapshot. Pages render read it synchronously
// (~1ms) and inline it into the HTML so first-time visitors — who have no
// localStorage copy yet — still get commits on screen immediately. Staleness
// is refreshed in the background via ctx.waitUntil, never blocking a render.
//
// KV write budget: background revalidation only fires when the snapshot is
// older than 15 minutes (~96 writes/day, under the 100/day target and the
// 1,000/day free allowance). KV reads are 1 per page view (100k/day free).
// A same-record timestamp and an in-isolate memory guard keep concurrent
// renders from stampeding the same refresh.

export const ICEBERG_DEFAULTS = {
	username: 'penqguin',
	limit: '5',
	historyLimit: '70',
};

const ICEBERG_URL = 'https://iceberg.penqguin.com/v2/commits/latest';

export const COMMITS_HEADERS = {
	'Content-Type': 'application/json',
	'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
} as const;

const SNAPSHOT_KV_KEY = 'igloo:commits:snapshot';
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // discard anything older — the client revalidates anyway
const SNAPSHOT_REVALIDATE_INTERVAL_MS = 15 * 60 * 1000; // refresh lease ⇒ ≤96 KV writes/day

export interface CommitData {
	commits: unknown[];
	languages: unknown[];
}

interface Snapshot {
	ts: number;
	data: CommitData;
}

// Mirrors the locals cast in api/commits.json.ts — the adapter provides
// locals.runtime on Cloudflare (and platformProxy fills it in `astro dev`).
interface Runtime {
	env?: Record<string, unknown>;
	ctx?: { waitUntil?: (p: Promise<unknown>) => void };
}

function runtimeOf(locals: unknown): Runtime {
	return (locals as { runtime?: Runtime } | undefined)?.runtime ?? {};
}

function kvNamespace(locals: unknown): unknown {
	return runtimeOf(locals).env?.SESSION;
}

export function icebergApiUrl(params: {
	username: string;
	limit: string;
	historyLimit: string;
}): string {
	return `${ICEBERG_URL}?username=${params.username}&limit=${params.limit}&history_limit=${params.historyLimit}`;
}

export function isValidCommitsData(value: unknown): value is CommitData {
	return (
		typeof value === 'object' &&
		value !== null &&
		Array.isArray((value as CommitData).commits) &&
		Array.isArray((value as CommitData).languages)
	);
}

// --- Fetch core (cache → iceberg), shared by the route and the revalidator ---

export async function fetchCommitsData(
	locals: unknown,
	params: { username: string; limit: string; historyLimit: string }
): Promise<CommitData> {
	const apiUrl = icebergApiUrl(params);

	// caches.default exists in the Cloudflare runtime only; degrade to a
	// plain fetch where it's absent.
	const cache = typeof caches !== 'undefined' ? caches.default : undefined;

	if (cache) {
		const cached = await cache.match(apiUrl);
		if (cached) {
			const data = await cached.json<CommitData>();
			if (isValidCommitsData(data)) return data;
		}
	}

	const response = await fetch(apiUrl, { headers: { 'User-Agent': 'igloo-portfolio' } });
	if (!response.ok) {
		throw new Error(`Iceberg API error: ${response.status}`);
	}
	const data = await response.json<CommitData>();
	if (!isValidCommitsData(data)) {
		throw new Error('Iceberg API returned an unexpected payload shape');
	}

	if (cache) {
		// waitUntil keeps the cache write alive once the response is returned.
		const waitUntil = runtimeOf(locals).ctx?.waitUntil;
		const put = cache
			.put(apiUrl, new Response(JSON.stringify(data), { headers: { ...COMMITS_HEADERS } }))
			.catch((err: unknown) => console.error('Failed to cache commits:', err));
		if (waitUntil) {
			waitUntil(put);
		}
	}

	return data;
}

// --- KV snapshot (server-side seed for instant first paint) ---

/** Synchronous-ish KV read: { ts, data } while fresher than 24h, else null. */
export async function readSnapshot(kv: unknown): Promise<Snapshot | null> {
	if (!kv || typeof (kv as { get?: unknown }).get !== 'function') return null;
	try {
		const raw = await (kv as { get: (k: string) => Promise<string | null> }).get(SNAPSHOT_KV_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Snapshot;
		if (!isValidCommitsData(parsed?.data) || typeof parsed.ts !== 'number') return null;
		if (Date.now() - parsed.ts > SNAPSHOT_MAX_AGE_MS) return null;
		return parsed;
	} catch (err) {
		console.error('Failed to read commits snapshot:', err);
		return null;
	}
}

async function writeSnapshot(kv: unknown, data: CommitData): Promise<void> {
	try {
		await (kv as { put: (k: string, v: string) => Promise<void> }).put(
			SNAPSHOT_KV_KEY,
			JSON.stringify({ ts: Date.now(), data })
		);
	} catch (err) {
		console.error('Failed to store commits snapshot:', err);
	}
}

// In-isolate guard: collapses per-render stampedes within one isolate so a
// burst of visitors triggers at most one refresh per 15 minutes there.
// Across isolates the KV timestamp is the authority, so worst case is a
// small burst of duplicate refreshes, still spaced ≥ 15 minutes apart.
let lastRevalidateAttempt = 0;

async function revalidate(locals: unknown, params: {
	username: string;
	limit: string;
	historyLimit: string;
}): Promise<void> {
	lastRevalidateAttempt = Date.now();
	try {
		const data = await fetchCommitsData(locals, params);
		const kv = kvNamespace(locals);
		if (kv) await writeSnapshot(kv, data);
	} catch (err) {
		// A failed revalidation leaves the previous snapshot in place;
		// the client's stale-while-revalidate path is unaffected.
		console.error('Failed to revalidate commits snapshot:', err);
	}
}

/**
 * Read the seed for a page render and schedule a background refresh when it
 * is missing or older than the revalidation interval. Never blocking.
 */
export async function getCommitsSeed(
	locals: unknown,
	params: { username: string; limit: string; historyLimit: string } = ICEBERG_DEFAULTS
): Promise<CommitData | null> {
	const kv = kvNamespace(locals);
	if (!kv) return null;

	const snapshot = await readSnapshot(kv);
	const isStale = !snapshot || Date.now() - snapshot.ts > SNAPSHOT_REVALIDATE_INTERVAL_MS;

	if (isStale && Date.now() - lastRevalidateAttempt > SNAPSHOT_REVALIDATE_INTERVAL_MS) {
		const waitUntil = runtimeOf(locals).ctx?.waitUntil;
		const refresh = revalidate(locals, params);
		if (waitUntil) {
			waitUntil(refresh);
		} else {
			await refresh;
		}
	}

	return snapshot?.data ?? null;
}
