jest.mock('@/lib/ledger', () => ({
  decimalToNumber: (value: unknown) => (value === null ? 0 : Number(value)),
  recalculateDailyBalance: jest.fn(),
}));

import type { Prisma } from '@prisma/client';
import { payPayroll, payrollWeek, revertPayment } from '@/lib/payroll';
import { recalculateDailyBalance } from '@/lib/ledger';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

function buildTx(advances: Array<{ id: string; monto: number; montoAplicado: number; businessDate: string }>) {
  const tx = {
    employee: {
      findUnique: jest.fn().mockResolvedValue({ id: 'emp_1', nombre: 'Ana', salarioDiario: 300 }),
    },
    attendance: {
      count: jest.fn().mockResolvedValue(5),
    },
    employeeAdvance: {
      findMany: jest.fn().mockResolvedValue(
        advances.map((a) => ({ ...a, businessDate: date(a.businessDate), createdAt: date(a.businessDate) })),
      ),
      update: jest.fn(),
    },
    expense: {
      create: jest.fn().mockResolvedValue({ id: 'exp_1' }),
      delete: jest.fn(),
    },
    employeePayment: {
      create: jest.fn().mockResolvedValue({ id: 'pay_1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'pay_1' }),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    payrollAdvanceApplication: {
      create: jest.fn(),
    },
  };
  return tx;
}

const asTx = (tx: unknown) => tx as Prisma.TransactionClient;

const baseInput = {
  businessDate: '2026-10-11',
  employeeId: 'emp_1',
  periodoInicio: '2026-10-05',
};

describe('payrollWeek', () => {
  it('spans Monday to Sunday', () => {
    const { inicio, fin } = payrollWeek('2026-10-05');
    expect(inicio.toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(fin.toISOString().slice(0, 10)).toBe('2026-10-11');
  });

  it('rejects a start date that is not Monday', () => {
    expect(() => payrollWeek('2026-10-06')).toThrow('periodoInicio debe ser un lunes');
  });
});

describe('payPayroll', () => {
  it('discounts advances oldest first, splitting a large one across weeks', async () => {
    // Subtotal: 5 días x 300 = 1500. Pendiente: 200 (viejo) + 2000 (nuevo, 500 ya aplicados).
    const tx = buildTx([
      { id: 'adv_old', monto: 200, montoAplicado: 0, businessDate: '2026-09-20' },
      { id: 'adv_big', monto: 2000, montoAplicado: 500, businessDate: '2026-10-01' },
    ]);

    await payPayroll(asTx(tx), { ...baseInput, adelantosAplicar: 700 });

    expect(tx.payrollAdvanceApplication.create).toHaveBeenNthCalledWith(1, {
      data: { paymentId: 'pay_1', advanceId: 'adv_old', monto: 200 },
    });
    expect(tx.payrollAdvanceApplication.create).toHaveBeenNthCalledWith(2, {
      data: { paymentId: 'pay_1', advanceId: 'adv_big', monto: 500 },
    });
    expect(tx.employeeAdvance.update).toHaveBeenCalledWith({
      where: { id: 'adv_big' },
      data: { montoAplicado: { increment: 500 } },
    });

    const paymentData = tx.employeePayment.create.mock.calls[0][0].data;
    expect(paymentData).toMatchObject({
      tipo: 'planilla',
      diasTrabajados: 5,
      subtotal: 1500,
      adelantosAplicados: 700,
      monto: 800,
      expenseId: 'exp_1',
    });
    expect(tx.expense.create.mock.calls[0][0].data.monto).toBe(800);
    expect(recalculateDailyBalance).toHaveBeenCalledWith(tx, '2026-10-11');
  });

  it('defaults to the maximum discount, capped by the subtotal', async () => {
    const tx = buildTx([{ id: 'adv_1', monto: 5000, montoAplicado: 0, businessDate: '2026-10-01' }]);

    await payPayroll(asTx(tx), baseInput);

    const paymentData = tx.employeePayment.create.mock.calls[0][0].data;
    expect(paymentData.adelantosAplicados).toBe(1500);
    expect(paymentData.monto).toBe(0);
    // Sin efectivo que sale de la caja no se crea gasto.
    expect(tx.expense.create).not.toHaveBeenCalled();
    expect(paymentData.expenseId).toBeNull();
  });

  it('rejects discounting more than is pending', async () => {
    const tx = buildTx([{ id: 'adv_1', monto: 100, montoAplicado: 0, businessDate: '2026-10-01' }]);

    await expect(payPayroll(asTx(tx), { ...baseInput, adelantosAplicar: 150 })).rejects.toThrow(
      'Solo se pueden descontar 100.00',
    );
    expect(tx.employeePayment.create).not.toHaveBeenCalled();
  });

  it('rejects a week without attendance', async () => {
    const tx = buildTx([]);
    tx.attendance.count.mockResolvedValue(0);

    await expect(payPayroll(asTx(tx), baseInput)).rejects.toThrow('no tiene días trabajados');
  });
});

describe('revertPayment', () => {
  it('returns each advance exactly what this payment discounted and removes the expense', async () => {
    const tx = buildTx([]);
    tx.employeePayment.findUnique.mockResolvedValue({
      id: 'pay_1',
      applications: [
        { advanceId: 'adv_old', monto: 200 },
        { advanceId: 'adv_big', monto: 500 },
      ],
      expense: { id: 'exp_1', businessDate: date('2026-10-11') },
    });

    await revertPayment(asTx(tx), 'pay_1');

    expect(tx.employeeAdvance.update).toHaveBeenCalledWith({
      where: { id: 'adv_old' },
      data: { montoAplicado: { decrement: 200 } },
    });
    expect(tx.employeeAdvance.update).toHaveBeenCalledWith({
      where: { id: 'adv_big' },
      data: { montoAplicado: { decrement: 500 } },
    });
    expect(tx.employeePayment.delete).toHaveBeenCalledWith({ where: { id: 'pay_1' } });
    expect(tx.expense.delete).toHaveBeenCalledWith({ where: { id: 'exp_1' } });
    expect(recalculateDailyBalance).toHaveBeenCalledWith(tx, '2026-10-11');
  });
});
