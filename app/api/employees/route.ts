import { createEmployeeSchema } from '@/lib/validations';
import { handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { emptyToNull, employeeInclude, mapEmployee } from '@/lib/employees';
import { assertActiveSucursal } from '@/lib/payroll';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sucursalId = searchParams.get('sucursalId');
    const activo = searchParams.get('activo');

    const employees = await prisma.employee.findMany({
      where: {
        ...(sucursalId ? { sucursalId } : {}),
        ...(activo === 'true' ? { activo: true } : activo === 'false' ? { activo: false } : {}),
      },
      include: employeeInclude,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });

    return success(employees.map(mapEmployee));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createEmployeeSchema.parse(await request.json());
    await assertActiveSucursal(prisma, payload.sucursalId);

    const employee = await prisma.employee.create({
      data: {
        sucursalId: payload.sucursalId,
        nombre: payload.nombre,
        puesto: emptyToNull(payload.puesto),
        telefono: emptyToNull(payload.telefono),
        salarioDiario: payload.salarioDiario,
        fechaIngreso: parseBusinessDate(payload.fechaIngreso),
      },
      include: employeeInclude,
    });

    return success(mapEmployee(employee), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
