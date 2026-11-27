jest.mock('@/lib/prisma', () => ({
  prisma: {
    purchase: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

import { GET } from '@/app/api/reports/purchases-by-user/route';
import { prisma } from '@/lib/prisma';

const mockedPrisma = prisma as unknown as {
  purchase: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

type ReportBody = {
  ok: boolean;
  data: {
    rows: Array<{ userId: string | null; nombre: string; compras: number; libras: number; total: number }>;
    totals: { compras: number; libras: number; total: number };
  };
};

describe('GET /api/reports/purchases-by-user', () => {
  it('groups purchases by the user who registered the transaction', async () => {
    mockedPrisma.purchase.findMany.mockResolvedValue([
      { id: 'p1', libras: 10, total: 40, purchaseTransactionId: 't1', purchaseTransaction: { createdByUserId: 'comprador1' } },
      { id: 'p2', libras: 5, total: 10, purchaseTransactionId: 't1', purchaseTransaction: { createdByUserId: 'comprador1' } },
      { id: 'p3', libras: 2, total: 100, purchaseTransactionId: 't2', purchaseTransaction: { createdByUserId: 'admin' } },
      { id: 'p4', libras: 1, total: 3, purchaseTransactionId: 't3', purchaseTransaction: { createdByUserId: null } },
    ]);
    mockedPrisma.user.findMany.mockResolvedValue([{ userId: 'comprador1', nombre: 'Juan' }]);

    const response = await GET(new Request('http://localhost/api/reports/purchases-by-user?from=2026-11-23&to=2026-11-29'));
    const body = (await response.json()) as ReportBody;

    expect(response.status).toBe(200);
    expect(body.data.rows).toEqual([
      { userId: 'admin', nombre: 'admin', compras: 1, libras: 2, total: 100 },
      { userId: 'comprador1', nombre: 'Juan', compras: 1, libras: 15, total: 50 },
      { userId: null, nombre: 'Sin usuario', compras: 1, libras: 1, total: 3 },
    ]);
    expect(body.data.totals).toEqual({ compras: 3, libras: 18, total: 153 });
  });

  it('requires from and to', async () => {
    const response = await GET(new Request('http://localhost/api/reports/purchases-by-user?from=2026-11-23'));
    expect(response.status).toBe(400);
  });
});
