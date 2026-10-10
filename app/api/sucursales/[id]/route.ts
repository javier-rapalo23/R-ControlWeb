import { updateSucursalSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { isUniqueViolation, mapSucursal } from '@/lib/employees';

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = updateSucursalSchema.parse(await request.json());

    const existing = await prisma.sucursal.findUnique({ where: { id } });
    if (!existing) {
      return failure('NOT_FOUND', 'Sucursal no encontrada', 404);
    }

    const sucursal = await prisma.sucursal.update({ where: { id }, data: payload });
    return success(mapSucursal(sucursal));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure('CONFLICT', 'Ya existe una sucursal con ese nombre', 409);
    }
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const existing = await prisma.sucursal.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, advances: true, payments: true } } },
    });
    if (!existing) {
      return failure('NOT_FOUND', 'Sucursal no encontrada', 404);
    }

    const { employees, advances, payments } = existing._count;
    if (employees + advances + payments > 0) {
      return failure('CONFLICT', 'La sucursal tiene empleados o movimientos; desactívela en lugar de eliminarla', 409);
    }

    await prisma.sucursal.delete({ where: { id } });
    return success({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
