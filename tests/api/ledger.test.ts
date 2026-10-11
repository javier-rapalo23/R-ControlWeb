import type { PrismaClient } from '@prisma/client';
import { recalculateDailyBalance } from '@/lib/ledger';

function buildDb() {
  const balance = {
    id: 'bal_1',
    businessDate: new Date('2026-10-11T00:00:00.000Z'),
    saldoInicial: 1000,
    saldoActual: 0,
    createdAt: new Date('2026-10-11T00:00:00.000Z'),
    updatedAt: new Date('2026-10-11T00:00:00.000Z'),
  };

  return {
    dailyBalance: {
      upsert: jest.fn().mockResolvedValue(balance),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...balance, ...data })),
    },
    purchase: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: 300.1 } }) },
    sale: { aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 500.2 } }) },
    expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 50 } }) },
    cashMovement: {
      groupBy: jest.fn().mockResolvedValue([
        { tipo: 'ingreso', _sum: { monto: 200 } },
        { tipo: 'salida', _sum: { monto: 400.3 } },
      ]),
    },
  };
}

describe('recalculateDailyBalance', () => {
  it('adds sales and cash-in, subtracts purchases, expenses and cash-out', async () => {
    const db = buildDb();

    const { totals } = await recalculateDailyBalance(db as unknown as PrismaClient, '2026-10-11');

    // 1000 + 500.20 + 200 - 300.10 - 50 - 400.30 = 949.80
    expect(totals).toEqual({
      totalCompras: 300.1,
      totalVentas: 500.2,
      totalGastos: 50,
      totalIngresos: 200,
      totalSalidas: 400.3,
      saldoActual: 949.8,
    });
    expect(db.dailyBalance.update).toHaveBeenCalledWith({ where: { id: 'bal_1' }, data: { saldoActual: 949.8 } });
  });

  it('treats a day without cash movements as zero', async () => {
    const db = buildDb();
    db.cashMovement.groupBy.mockResolvedValue([]);

    const { totals } = await recalculateDailyBalance(db as unknown as PrismaClient, '2026-10-11');

    expect(totals.totalIngresos).toBe(0);
    expect(totals.totalSalidas).toBe(0);
    expect(totals.saldoActual).toBe(1150.1);
  });
});
