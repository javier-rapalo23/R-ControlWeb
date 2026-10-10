import { Prisma, PrismaClient } from '@prisma/client';
import { parseBusinessDate, toBusinessDateString } from '@/lib/business-date';
import { recalculateDailyBalance } from '@/lib/ledger';
import { fromCents, mapPayment, employeeNameInclude, toCents } from '@/lib/employees';
import type { PayrollDTO, PayrollRowDTO } from '@/types/domain';

type DbClient = PrismaClient | Prisma.TransactionClient;

// La planilla es semanal, de lunes a domingo (igual que el resumen semanal del dashboard).
export function payrollWeek(periodoInicioInput: string) {
  const inicio = parseBusinessDate(periodoInicioInput);
  if (inicio.getUTCDay() !== 1) {
    throw new Error('periodoInicio debe ser un lunes');
  }

  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 6);
  return { inicio, fin };
}

// La asistencia de una semana ya pagada no puede cambiar: desincronizaría la planilla.
export async function assertDateNotInPaidPayroll(db: DbClient, employeeId: string, businessDate: Date) {
  const paid = await db.employeePayment.findFirst({
    where: {
      employeeId,
      tipo: 'planilla',
      periodoInicio: { lte: businessDate },
      periodoFin: { gte: businessDate },
    },
  });
  if (paid) {
    throw new Error('Esa semana ya tiene planilla pagada; revierta el pago para modificar la asistencia');
  }
}

function pendingCents(advance: { monto: Prisma.Decimal; montoAplicado: Prisma.Decimal }) {
  return toCents(advance.monto) - toCents(advance.montoAplicado);
}

export async function computePayroll(db: DbClient, periodoInicioInput: string): Promise<PayrollDTO> {
  const { inicio, fin } = payrollWeek(periodoInicioInput);
  const inPeriod = { gte: inicio, lte: fin };

  // Se incluyen inactivos con asistencia en la semana para no dejar días sin pagar.
  const employees = await db.employee.findMany({
    where: { OR: [{ activo: true }, { attendances: { some: { businessDate: inPeriod } } }] },
    orderBy: { nombre: 'asc' },
  });
  const ids = employees.map((employee) => employee.id);

  const [attendanceCounts, advances, payments] = await Promise.all([
    db.attendance.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: ids }, businessDate: inPeriod },
      _count: { _all: true },
    }),
    db.employeeAdvance.findMany({
      where: { employeeId: { in: ids }, businessDate: { lte: fin } },
    }),
    db.employeePayment.findMany({
      where: { employeeId: { in: ids }, tipo: 'planilla', periodoInicio: inicio },
      include: employeeNameInclude,
    }),
  ]);

  const daysByEmployee = new Map(attendanceCounts.map((row) => [row.employeeId, row._count._all]));
  const paymentByEmployee = new Map(payments.map((payment) => [payment.employeeId, payment]));
  const pendingByEmployee = new Map<string, number>();
  for (const advance of advances) {
    pendingByEmployee.set(
      advance.employeeId,
      (pendingByEmployee.get(advance.employeeId) ?? 0) + pendingCents(advance),
    );
  }

  const rows: PayrollRowDTO[] = employees.map((employee) => {
    const diasTrabajados = daysByEmployee.get(employee.id) ?? 0;
    const subtotal = diasTrabajados * toCents(employee.salarioDiario);
    const pendientes = pendingByEmployee.get(employee.id) ?? 0;
    const aplicables = Math.min(subtotal, pendientes);
    const payment = paymentByEmployee.get(employee.id);

    return {
      employeeId: employee.id,
      employeeNombre: employee.nombre,
      salarioDiario: fromCents(toCents(employee.salarioDiario)),
      diasTrabajados,
      subtotal: fromCents(subtotal),
      adelantosPendientes: fromCents(pendientes),
      adelantosAplicables: fromCents(aplicables),
      neto: fromCents(subtotal - aplicables),
      payment: payment ? mapPayment(payment) : null,
    };
  });

  return {
    periodoInicio: toBusinessDateString(inicio),
    periodoFin: toBusinessDateString(fin),
    rows,
  };
}

export async function payPayroll(
  tx: Prisma.TransactionClient,
  input: {
    businessDate: string;
    employeeId: string;
    periodoInicio: string;
    adelantosAplicar?: number;
  },
) {
  const { inicio, fin } = payrollWeek(input.periodoInicio);
  const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new Error('Empleado no encontrado');

  const diasTrabajados = await tx.attendance.count({
    where: { employeeId: employee.id, businessDate: { gte: inicio, lte: fin } },
  });
  if (diasTrabajados === 0) {
    throw new Error('El empleado no tiene días trabajados en esa semana');
  }

  const subtotal = diasTrabajados * toCents(employee.salarioDiario);

  // Los adelantos más antiguos se descuentan primero.
  const advances = (
    await tx.employeeAdvance.findMany({
      where: { employeeId: employee.id, businessDate: { lte: fin } },
      orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }],
    })
  ).filter((advance) => pendingCents(advance) > 0);

  const maxAplicable = Math.min(
    subtotal,
    advances.reduce((sum, advance) => sum + pendingCents(advance), 0),
  );
  const aplicar = input.adelantosAplicar === undefined ? maxAplicable : toCents(input.adelantosAplicar);
  if (aplicar > maxAplicable) {
    throw new Error(`Solo se pueden descontar ${fromCents(maxAplicable).toFixed(2)} de adelantos en esta planilla`);
  }

  const neto = subtotal - aplicar;
  const periodo = `${toBusinessDateString(inicio)} al ${toBusinessDateString(fin)}`;

  // Si los adelantos cubren todo no sale efectivo de la caja, así que no hay gasto.
  const expense =
    neto > 0
      ? await tx.expense.create({
          data: {
            businessDate: parseBusinessDate(input.businessDate),
            categoria: 'Planilla',
            descripcion: `Planilla ${employee.nombre} ${periodo}`,
            monto: fromCents(neto),
          },
        })
      : null;

  const payment = await tx.employeePayment.create({
    data: {
      businessDate: parseBusinessDate(input.businessDate),
      employeeId: employee.id,
      tipo: 'planilla',
      monto: fromCents(neto),
      descripcion: `Planilla ${periodo}`,
      periodoInicio: inicio,
      periodoFin: fin,
      diasTrabajados,
      subtotal: fromCents(subtotal),
      adelantosAplicados: fromCents(aplicar),
      expenseId: expense?.id ?? null,
    },
  });

  let restante = aplicar;
  for (const advance of advances) {
    if (restante <= 0) break;
    const monto = Math.min(restante, pendingCents(advance));
    await tx.payrollAdvanceApplication.create({
      data: { paymentId: payment.id, advanceId: advance.id, monto: fromCents(monto) },
    });
    // El incremento es atómico y el CHECK de la tabla impide pasar de `monto`
    // si otra planilla tomó el mismo adelanto en paralelo.
    await tx.employeeAdvance.update({
      where: { id: advance.id },
      data: { montoAplicado: { increment: fromCents(monto) } },
    });
    restante -= monto;
  }

  if (expense) {
    await recalculateDailyBalance(tx, input.businessDate);
  }

  return tx.employeePayment.findUniqueOrThrow({ where: { id: payment.id }, include: employeeNameInclude });
}

// Revierte un pago (manual o planilla): devuelve a cada adelanto lo que esta planilla
// le descontó y elimina el gasto que sacó el efectivo de la caja.
export async function revertPayment(tx: Prisma.TransactionClient, paymentId: string) {
  const payment = await tx.employeePayment.findUnique({
    where: { id: paymentId },
    include: { applications: true, expense: true },
  });
  if (!payment) return null;

  for (const application of payment.applications) {
    await tx.employeeAdvance.update({
      where: { id: application.advanceId },
      data: { montoAplicado: { decrement: application.monto } },
    });
  }

  await tx.employeePayment.delete({ where: { id: payment.id } });

  if (payment.expense) {
    await tx.expense.delete({ where: { id: payment.expense.id } });
    await recalculateDailyBalance(tx, toBusinessDateString(payment.expense.businessDate));
  }

  return payment;
}
