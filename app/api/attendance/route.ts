import { upsertAttendanceSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { attendanceInclude, mapAttendance } from '@/lib/employees';
import { assertDateNotInPaidPayroll } from '@/lib/payroll';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessDate = searchParams.get('businessDate');
    const from = searchParams.get('from') ?? businessDate;
    const to = searchParams.get('to') ?? businessDate;
    const employeeId = searchParams.get('employeeId');
    const sucursalId = searchParams.get('sucursalId');

    if (!from || !to) {
      return failure('VALIDATION_ERROR', 'businessDate o from y to son requeridos', 400);
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        businessDate: { gte: parseBusinessDate(from), lte: parseBusinessDate(to) },
        ...(employeeId ? { employeeId } : {}),
        ...(sucursalId ? { employee: { sucursalId } } : {}),
      },
      include: attendanceInclude,
      orderBy: [{ businessDate: 'asc' }, { horaEntrada: 'asc' }],
    });

    return success(attendances.map(mapAttendance));
  } catch (error) {
    return handleApiError(error);
  }
}

// Registra o corrige la asistencia de un empleado en un día (una por día).
export async function POST(request: Request) {
  try {
    const payload = upsertAttendanceSchema.parse(await request.json());
    const businessDate = parseBusinessDate(payload.businessDate);

    const employee = await prisma.employee.findUnique({ where: { id: payload.employeeId } });
    if (!employee) {
      return failure('NOT_FOUND', 'Empleado no encontrado', 404);
    }
    if (businessDate < employee.fechaIngreso) {
      return failure('VALIDATION_ERROR', 'La fecha es anterior al ingreso del empleado', 400);
    }

    await assertDateNotInPaidPayroll(prisma, employee.id, businessDate);

    const data = { horaEntrada: payload.horaEntrada, horaSalida: payload.horaSalida ?? null };
    const attendance = await prisma.attendance.upsert({
      where: { businessDate_employeeId: { businessDate, employeeId: employee.id } },
      update: data,
      create: { businessDate, employeeId: employee.id, ...data },
      include: attendanceInclude,
    });

    return success(mapAttendance(attendance), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
