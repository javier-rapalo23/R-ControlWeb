import { createCashMovementSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { mapCashMovement, recalculateDailyBalance } from '@/lib/ledger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessDate = searchParams.get('businessDate');
    if (!businessDate) {
      return failure('VALIDATION_ERROR', 'businessDate es requerido', 400);
    }

    const movements = await prisma.cashMovement.findMany({
      where: { businessDate: parseBusinessDate(businessDate) },
      orderBy: { createdAt: 'desc' },
    });

    return success(movements.map(mapCashMovement));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createCashMovementSchema.parse(await request.json());

    const movement = await prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          businessDate: parseBusinessDate(payload.businessDate),
          tipo: payload.tipo,
          concepto: payload.concepto,
          monto: payload.monto,
        },
      });

      await recalculateDailyBalance(tx, payload.businessDate);
      return created;
    });

    return success(mapCashMovement(movement), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
