import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'tictactoe.json');

async function getCache(key: string): Promise<unknown | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(data);
    if (cache[key] && Date.now() - cache[key].timestamp < CACHE_DURATION) {
      return cache[key].data;
    }
  } catch {
    // Cache miss or error
  }
  return null;
}

async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    let existing: Record<string, CacheEntry> = {};
    try {
      const existingData = await fs.readFile(CACHE_FILE, 'utf-8');
      existing = JSON.parse(existingData);
    } catch {
      // File doesn't exist yet
    }
    existing[key] = { data, timestamp: Date.now() };
    await fs.writeFile(CACHE_FILE, JSON.stringify(existing));
  } catch (e) {
    console.error('Cache write failed:', e);
  }
}

// Handle GET for fetching win count
export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get('action') ?? 'get';

  try {
    const cacheKey = 'tictactoe-wins';

    // Try cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'HIT'
        }
      });
    }

    // Fetch from Abacus API
    const response = await fetch('https://abacus.jsn.cam/get/igloo/tictactoe-wins');

    if (!response.ok) {
      throw new Error(`Abacus API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    await setCache(cacheKey, data);

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
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
    // Fetch from Abacus API to increment
    const response = await fetch('https://abacus.jsn.cam/hit/igloo/tictactoe-wins');

    if (!response.ok) {
      throw new Error(`Abacus API error: ${response.status}`);
    }

    const data = await response.json();

    // Clear cache after update
    try {
      const CACHE_DIR = path.join(process.cwd(), '.cache');
      const CACHE_FILE = path.join(CACHE_DIR, 'tictactoe.json');
      const existingData = await fs.readFile(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(existingData);
      delete cache['tictactoe-wins'];
      await fs.writeFile(CACHE_FILE, JSON.stringify(cache));
    } catch {
      // Cache file might not exist, that's okay
    }

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
