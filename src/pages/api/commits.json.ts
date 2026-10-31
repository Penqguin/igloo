import type { APIRoute } from 'astro';
import { COMMITS_HEADERS, fetchCommitsData, ICEBERG_DEFAULTS } from '../../utils/iceberg';

export const prerender = false;

// Edge cache for this route in the Workers Cache API (caches.default).
// Without it, every page load re-runs the whole chain: this route →
// iceberg worker → GitHub (a ~3.7 s miss when iceberg's cache has expired).
// Entry TTL follows the stored response's Cache-Control (s-maxage=3600).
// See docs/faster-iceberg-fetch.md.
export const GET: APIRoute = async ({ url, locals }) => {
	const params = {
		username: url.searchParams.get('username') ?? ICEBERG_DEFAULTS.username,
		limit: url.searchParams.get('limit') ?? ICEBERG_DEFAULTS.limit,
		historyLimit: url.searchParams.get('history_limit') ?? ICEBERG_DEFAULTS.historyLimit,
	};

	try {
		// Fetch + edge-cache logic lives in utils/iceberg.ts so page renders can
		// reuse it to refresh the first-paint snapshot without blocking.
		const data = await fetchCommitsData(locals, params);
		return new Response(JSON.stringify(data), { headers: { ...COMMITS_HEADERS } });
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
