import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkHealth } from '../server/health';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, HEAD');
    response.statusCode = 405;
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const result = await checkHealth({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY });
  response.statusCode = result.statusCode;
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify(result.body));
}
