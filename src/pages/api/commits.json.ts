import type { APIRoute } from 'astro';

export const prerender = false;

// Edge cache for this route in the Workers Cache API (caches.default).
// Without it, every page load re-runs the whole chain: this route →
// iceberg worker → GitHub (a ~3.7 s miss when iceberg's cache has expired).
// Entry TTL follows the stored response's Cache-Control (s-maxage=3600).
// See docs/faster-iceberg-fetch.md.
export const GET: APIRoute = async ({ url, locals }) => {
	const username = url.searchParams.get('username') ?? 'penqguin';
	const limit = url.searchParams.get('limit') ?? '5';
	const historyLimit = url.searchParams.get('history_limit') ?? '70';

	// The iceberg URL doubles as the Cache API key: fully-qualified, valid,
	// and parameter-exact with what the dashboard widget requests.
	const apiUrl = `https://iceberg.penqguin.com/v2/commits/latest?username=${username}&limit=${limit}&history_limit=${historyLimit}`;
	const headers = {
		'Content-Type': 'application/json',
		'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
	};

	try {
		// caches.default exists in the Cloudflare runtime only; degrade to a
		// plain proxy pass where it's absent.
		const cache = typeof caches !== 'undefined' ? caches.default : undefined;

		if (cache) {
			const cached = await cache.match(apiUrl);
			if (cached) {
				return cached;
			}
		}

		const response = await fetch(apiUrl, { headers: { 'User-Agent': 'igloo-portfolio' } });

		if (!response.ok) {
			throw new Error(`Iceberg API error: ${response.status}`);
		}

		const data = await response.json();
		const resp = new Response(JSON.stringify(data), { headers });

		if (cache) {
			// waitUntil keeps the cache write alive once the response is returned.
			// locals.runtime is provided by the @astrojs/cloudflare adapter;
			// fall back to a fire-and-forget put where it isn't available.
			const runtime = (locals as { runtime?: { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } }).runtime;
			const put = cache
				.put(apiUrl, resp.clone())
				.catch((err: unknown) => console.error('Failed to cache commits:', err));
			if (runtime?.ctx?.waitUntil) {
				runtime.ctx.waitUntil(put);
			}
		}

		return resp;
	} catch (error) {
		console.error('Failed to fetch commits:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to fetch commits', commits: [], languages: [] }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
