import { updateEmployeeSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import { emptyToNull, mapEmployee } from '@/lib/employees';

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = updateEmployeeSchema.parse(await request.json());

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return failure('NOT_FOUND', 'Empleado no encontrado', 404);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        nombre: payload.nombre,
        puesto: emptyToNull(payload.puesto),
        telefono: emptyToNull(payload.telefono),
        salarioDiario: payload.salarioDiario,
        fechaIngreso: payload.fechaIngreso ? parseBusinessDate(payload.fechaIngreso) : undefined,
        activo: payload.activo,
      },
    });

    return success(mapEmployee(employee));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: { attendances: true, advances: true, payments: true } } },
    });
    if (!existing) {
      return failure('NOT_FOUND', 'Empleado no encontrado', 404);
    }

    const { attendances, advances, payments } = existing._count;
    if (attendances + advances + payments > 0) {
      return failure('CONFLICT', 'El empleado tiene historial; desactívelo en lugar de eliminarlo', 409);
    }

    await prisma.employee.delete({ where: { id } });
    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
