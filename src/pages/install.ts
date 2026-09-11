import type { APIRoute } from 'astro';
import snapshot from '../data/release-snapshot.json';

export const GET: APIRoute = () => new Response(snapshot.installer, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  },
});
