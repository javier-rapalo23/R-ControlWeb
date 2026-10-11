import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { toBusinessDateString } from '@/lib/business-date';
import { recalculateDailyBalance } from '@/lib/ledger';

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashMovement.findUnique({ where: { id } });
      if (!existing) {
        return null;
      }

      await tx.cashMovement.delete({ where: { id } });
      await recalculateDailyBalance(tx, toBusinessDateString(existing.businessDate));
      return existing;
    });

    if (!deleted) {
      return failure('NOT_FOUND', 'Movimiento no encontrado', 404);
    }

    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
