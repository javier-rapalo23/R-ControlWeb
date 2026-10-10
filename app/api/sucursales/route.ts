import { createSucursalSchema } from '@/lib/validations';
import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { isUniqueViolation, mapSucursal } from '@/lib/employees';

export async function GET() {
  try {
    const sucursales = await prisma.sucursal.findMany({ orderBy: { nombre: 'asc' } });
    return success(sucursales.map(mapSucursal));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createSucursalSchema.parse(await request.json());
    const sucursal = await prisma.sucursal.create({ data: { nombre: payload.nombre } });
    return success(mapSucursal(sucursal), 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure('CONFLICT', 'Ya existe una sucursal con ese nombre', 409);
    }
    return handleApiError(error);
  }
}
