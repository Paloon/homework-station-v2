export interface HealthConfig { url?: string; key?: string; timeoutMs?: number }
export interface HealthResult {
  statusCode: 200 | 503;
  body: { status: 'ok' | 'degraded'; database: 'ok' | 'error' | 'timeout'; checkedAt: string };
}

export async function checkHealth(config: HealthConfig, fetcher: typeof fetch = fetch): Promise<HealthResult> {
  const checkedAt = new Date().toISOString();
  const failure = (database: 'error' | 'timeout'): HealthResult => ({ statusCode: 503, body: { status: 'degraded', database, checkedAt } });
  if (!config.url || !config.key) return failure('error');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);
  try {
    const url = new URL('/rest/v1/classrooms?select=id&limit=1', config.url);
    if (!['https:', 'http:'].includes(url.protocol)) return failure('error');
    const response = await fetcher(url, { signal: controller.signal, cache: 'no-store', headers: { apikey: config.key } });
    if (!response.ok || !Array.isArray(await response.json())) return failure('error');
    return { statusCode: 200, body: { status: 'ok', database: 'ok', checkedAt } };
  } catch { return failure(controller.signal.aborted ? 'timeout' : 'error'); }
  finally { clearTimeout(timer); }
}
