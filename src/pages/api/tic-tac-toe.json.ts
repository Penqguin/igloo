import type { APIRoute } from 'astro';

export const prerender = false;

const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes
let winsCache: { data: { value: number }; timestamp: number } | null = null;

async function getCachedWins(): Promise<{ value: number } | null> {
  if (winsCache && Date.now() - winsCache.timestamp < CACHE_DURATION) {
    return winsCache.data;
  }
  return null;
}

function setCachedWins(data: { value: number }): void {
  winsCache = { data, timestamp: Date.now() };
}

function clearWinsCache(): void {
  winsCache = null;
}

// Handle GET for fetching win count
export const GET: APIRoute = async () => {
  try {
    const cached = await getCachedWins();
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
          'X-Cache': 'HIT'
        }
      });
    }

    const response = await fetch('https://abacus.jsn.cam/get/igloo/tictactoe-wins');

    if (!response.ok) {
      throw new Error(`Abacus API error: ${response.status}`);
    }

    const data = await response.json();
    setCachedWins(data);

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Failed to fetch tic-tac-toe wins:', error);
    return new Response(
      JSON.stringify({ value: 0 }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

// Handle POST for incrementing win count
export const POST: APIRoute = async () => {
  try {
    const response = await fetch('https://abacus.jsn.cam/hit/igloo/tictactoe-wins');

    if (!response.ok) {
      throw new Error(`Abacus API error: ${response.status}`);
    }

    const data = await response.json();

    // Clear cache so next GET fetches fresh data
    clearWinsCache();

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to increment tic-tac-toe wins:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to increment wins' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
