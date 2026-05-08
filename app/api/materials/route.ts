import { createMaterialSchema } from '@/lib/validations';
import { handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const materials = await prisma.material.findMany({ orderBy: { createdAt: 'desc' } });
    return success(
      materials.map((material) => ({
        ...material,
        precioPorLibra: Number(material.precioPorLibra),
        createdAt: material.createdAt.toISOString(),
        updatedAt: material.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createMaterialSchema.parse(await request.json());

    const material = await prisma.material.create({
      data: {
        nombre: payload.nombre,
        precioPorLibra: payload.precioPorLibra,
      },
    });

    return success(
      {
        ...material,
        precioPorLibra: Number(material.precioPorLibra),
        createdAt: material.createdAt.toISOString(),
        updatedAt: material.updatedAt.toISOString(),
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}