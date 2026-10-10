import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { revertPayment } from '@/lib/payroll';

type Params = {
  params: Promise<{ id: string }>;
};

// Revierte el pago: devuelve los adelantos descontados y elimina el gasto asociado.
export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const reverted = await prisma.$transaction((tx) => revertPayment(tx, id));

    if (!reverted) {
      return failure('NOT_FOUND', 'Pago no encontrado', 404);
    }

    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
