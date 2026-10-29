import { describe, expect, it, vi } from 'vitest';
import { checkHealth } from '../../server/health';
const config = { url: 'https://test.supabase.co', key: 'test-publishable' };

describe('health dependency check', () => {
  it.each([{ rows: [] }, { rows: [{ id: 'classroom' }] }])('query ว่างหรือมีข้อมูลถือว่าฐานข้อมูลพร้อม: %j', async ({ rows }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(rows)));
    expect((await checkHealth(config, fetcher)).statusCode).toBe(200);
    expect(String(fetcher.mock.calls[0][0])).toContain('select=id&limit=1');
  });
  it('ไม่มี config ไม่เรียก network และไม่อ้างว่า healthy', async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect((await checkHealth({}, fetcher)).statusCode).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('HTTP error, network error และ HTML ไม่ healthy', async () => {
    for (const response of [new Response('{}', { status: 500 }), new Response('<html>web</html>')]) {
      expect((await checkHealth(config, vi.fn<typeof fetch>().mockResolvedValue(response))).statusCode).toBe(503);
    }
    expect((await checkHealth(config, vi.fn<typeof fetch>().mockRejectedValue(new Error('network')))).body.database).toBe('error');
  });
  it('timeout ยกเลิก request จริง', async () => {
    let signal: AbortSignal | undefined;
    const fetcher: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    const result = await checkHealth({ ...config, timeoutMs: 10 }, fetcher);
    expect(result.statusCode).toBe(503);
    expect(result.body.database).toBe('timeout');
    expect(signal?.aborted).toBe(true);
  });
});
