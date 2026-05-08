import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns service status ok', async () => {
    const response = await GET();
    const body = (await response.json()) as { ok: boolean; data: { status: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('ok');
  });
});