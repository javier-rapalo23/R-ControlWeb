import { createEmployeeAdvanceSchema } from '@/lib/validations';
import { handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { recalculateDailyBalance } from '@/lib/ledger';
import { emptyToNull, mapAdvance, employeeNameInclude } from '@/lib/employees';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const soloPendientes = searchParams.get('pendientes') === 'true';

    const advances = await prisma.employeeAdvance.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(from || to
          ? {
              businessDate: {
                ...(from ? { gte: parseBusinessDate(from) } : {}),
                ...(to ? { lte: parseBusinessDate(to) } : {}),
              },
            }
          : {}),
      },
      include: employeeNameInclude,
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    });

    const mapped = advances.map(mapAdvance);
    return success(soloPendientes ? mapped.filter((advance) => advance.pendiente > 0) : mapped);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createEmployeeAdvanceSchema.parse(await request.json());
    const descripcion = emptyToNull(payload.descripcion);

    const advance = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: payload.employeeId } });
      if (!employee) throw new Error('Empleado no encontrado');
      if (!employee.activo) throw new Error('El empleado está inactivo');

      // El adelanto sale de la caja: se registra como gasto para que descuente el saldo del día.
      const expense = await tx.expense.create({
        data: {
          businessDate: parseBusinessDate(payload.businessDate),
          categoria: 'Adelanto',
          descripcion: descripcion ? `Adelanto ${employee.nombre} - ${descripcion}` : `Adelanto ${employee.nombre}`,
          monto: payload.monto,
        },
      });

      const created = await tx.employeeAdvance.create({
        data: {
          businessDate: parseBusinessDate(payload.businessDate),
          employeeId: employee.id,
          monto: payload.monto,
          descripcion,
          expenseId: expense.id,
        },
        include: employeeNameInclude,
      });

      await recalculateDailyBalance(tx, payload.businessDate);
      return created;
    });

    return success(mapAdvance(advance), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
