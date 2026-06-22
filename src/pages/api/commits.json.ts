import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const username = url.searchParams.get('username') ?? 'penqguin';
  const limit = url.searchParams.get('limit') ?? '5';
  const historyLimit = url.searchParams.get('history_limit') ?? '70';

  try {
    const response = await fetch(
      `https://iceberg.penqguin.com/v2/commits/latest?username=${username}&limit=${limit}&history_limit=${historyLimit}`,
      { headers: { 'User-Agent': 'igloo-portfolio' } }
    );

    if (!response.ok) {
      throw new Error(`Iceberg API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      }
    });
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
