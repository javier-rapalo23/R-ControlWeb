import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { assertDateNotInPaidPayroll } from '@/lib/payroll';

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const existing = await prisma.attendance.findUnique({ where: { id } });
    if (!existing) {
      return failure('NOT_FOUND', 'Asistencia no encontrada', 404);
    }

    await assertDateNotInPaidPayroll(prisma, existing.employeeId, existing.businessDate);
    await prisma.attendance.delete({ where: { id } });
    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
