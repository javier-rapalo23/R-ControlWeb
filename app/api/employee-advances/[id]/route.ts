import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { toBusinessDateString } from '@/lib/business-date';
import { recalculateDailyBalance } from '@/lib/ledger';
import { toCents } from '@/lib/employees';

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.employeeAdvance.findUnique({ where: { id }, include: { expense: true } });
      if (!existing) return null;

      if (toCents(existing.montoAplicado) > 0) {
        throw new Error('El adelanto ya se descontó en una planilla; revierta esa planilla primero');
      }

      await tx.employeeAdvance.delete({ where: { id } });
      if (existing.expense) {
        await tx.expense.delete({ where: { id: existing.expense.id } });
        await recalculateDailyBalance(tx, toBusinessDateString(existing.expense.businessDate));
      }
      return existing;
    });

    if (!deleted) {
      return failure('NOT_FOUND', 'Adelanto no encontrado', 404);
    }

    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
