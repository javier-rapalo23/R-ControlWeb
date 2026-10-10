import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { recalculateDailyBalance } from '@/lib/ledger';

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findUnique({
        where: { id },
        include: { employeePayment: { select: { id: true } }, employeeAdvance: { select: { id: true } } },
      });
      if (!existing) {
        return null;
      }

      // Borrarlo aquí dejaría el pago o adelanto sin descontar de la caja.
      if (existing.employeePayment || existing.employeeAdvance) {
        throw new Error('Este gasto pertenece a un pago o adelanto de empleado; reviértalo desde Empleados');
      }

      await tx.expense.delete({ where: { id } });
      await recalculateDailyBalance(tx, existing.businessDate.toISOString().slice(0, 10));
      return existing;
    });

    if (!deleted) {
      return failure('NOT_FOUND', 'Expense not found', 404);
    }

    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}