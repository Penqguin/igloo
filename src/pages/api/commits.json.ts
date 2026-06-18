import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'commits.json');

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

export const GET: APIRoute = async ({ url }) => {
  const username = url.searchParams.get('username') ?? 'penqguin';
  const limit = url.searchParams.get('limit') ?? '5';
  const historyLimit = url.searchParams.get('history_limit') ?? '70';

  const cacheKey = `${username}-${limit}-${historyLimit}`;

  try {
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

    // Fetch from Iceberg API
    const response = await fetch(
      `https://iceberg.penqguin.com/v2/commits/latest?username=${username}&limit=${limit}&history_limit=${historyLimit}`,
      { headers: { 'User-Agent': 'igloo-portfolio' } }
    );

    if (!response.ok) {
      throw new Error(`Iceberg API error: ${response.status}`);
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
