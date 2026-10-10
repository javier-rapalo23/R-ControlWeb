import { createEmployeePaymentSchema } from '@/lib/validations';
import { handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { recalculateDailyBalance } from '@/lib/ledger';
import { emptyToNull, mapPayment, movementInclude } from '@/lib/employees';
import { assertActiveSucursal } from '@/lib/payroll';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const tipo = searchParams.get('tipo');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const payments = await prisma.employeePayment.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(tipo === 'manual' || tipo === 'planilla' ? { tipo } : {}),
        ...(from || to
          ? {
              businessDate: {
                ...(from ? { gte: parseBusinessDate(from) } : {}),
                ...(to ? { lte: parseBusinessDate(to) } : {}),
              },
            }
          : {}),
      },
      include: movementInclude,
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    });

    return success(payments.map(mapPayment));
  } catch (error) {
    return handleApiError(error);
  }
}

// Pago capturado a mano. Los pagos de planilla se generan en /api/payroll/pay.
export async function POST(request: Request) {
  try {
    const payload = createEmployeePaymentSchema.parse(await request.json());
    const descripcion = emptyToNull(payload.descripcion);

    const payment = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: payload.employeeId } });
      if (!employee) throw new Error('Empleado no encontrado');
      await assertActiveSucursal(tx, payload.sucursalId);

      const expense = await tx.expense.create({
        data: {
          businessDate: parseBusinessDate(payload.businessDate),
          categoria: 'Pago empleado',
          descripcion: descripcion ? `Pago ${employee.nombre} - ${descripcion}` : `Pago ${employee.nombre}`,
          monto: payload.monto,
        },
      });

      const created = await tx.employeePayment.create({
        data: {
          businessDate: parseBusinessDate(payload.businessDate),
          employeeId: employee.id,
          sucursalId: payload.sucursalId,
          tipo: 'manual',
          monto: payload.monto,
          descripcion,
          expenseId: expense.id,
        },
        include: movementInclude,
      });

      await recalculateDailyBalance(tx, payload.businessDate);
      return created;
    });

    return success(mapPayment(payment), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
