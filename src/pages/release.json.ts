import type { APIRoute } from 'astro';
import snapshot from '../data/release-snapshot.json';

export const GET: APIRoute = () => new Response(JSON.stringify(snapshot.release, null, 2) + '\n', {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  },
});
