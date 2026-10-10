import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { computePayroll } from '@/lib/payroll';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoInicio = searchParams.get('periodoInicio');
    if (!periodoInicio) {
      return failure('VALIDATION_ERROR', 'periodoInicio es requerido', 400);
    }

    const payroll = await computePayroll(prisma, periodoInicio);
    return success(payroll);
  } catch (error) {
    return handleApiError(error);
  }
}
