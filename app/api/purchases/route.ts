import { Prisma } from '@prisma/client';
import { createPurchaseSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { recalculateDailyBalance } from '@/lib/ledger';

export async function POST(request: Request) {
  try {
    const payload = createPurchaseSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: payload.materialId } });
      if (!material) {
        throw new Error('Material not found');
      }

      const precioPorLibra = new Prisma.Decimal(payload.precioPorLibra ?? Number(material.precioPorLibra));
      const libras = new Prisma.Decimal(payload.libras);
      const total = precioPorLibra.mul(libras);

      const created = await tx.purchase.create({
        data: {
          businessDate: parseBusinessDate(payload.businessDate),
          materialId: material.id,
          materialNombre: material.nombre,
          precioPorLibra,
          libras,
          total,
        },
      });

      await recalculateDailyBalance(tx, payload.businessDate);
      return created;
    });

    return success(
      {
        ...result,
        businessDate: result.businessDate.toISOString().slice(0, 10),
        precioPorLibra: Number(result.precioPorLibra),
        libras: Number(result.libras),
        total: Number(result.total),
        createdAt: result.createdAt.toISOString(),
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Material not found') {
      return failure('NOT_FOUND', error.message, 404);
    }

    return handleApiError(error);
  }
}