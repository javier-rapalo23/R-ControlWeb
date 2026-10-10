import { payPayrollSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { isUniqueViolation, mapPayment } from '@/lib/employees';
import { payPayroll } from '@/lib/payroll';

export async function POST(request: Request) {
  try {
    const payload = payPayrollSchema.parse(await request.json());
    const payment = await prisma.$transaction((tx) => payPayroll(tx, payload));
    return success(mapPayment(payment), 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure('CONFLICT', 'Ese empleado ya tiene la planilla de esa semana pagada', 409);
    }
    return handleApiError(error);
  }
}
