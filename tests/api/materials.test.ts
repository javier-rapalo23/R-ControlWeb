jest.mock('@/lib/prisma', () => ({
  prisma: {
    material: {
      create: jest.fn(),
    },
  },
}));

import { POST } from '@/app/api/materials/route';
import { prisma } from '@/lib/prisma';

const mockedPrisma = prisma as unknown as {
  material: {
    create: jest.Mock;
  };
};

describe('POST /api/materials', () => {
  it('creates material and returns 201', async () => {
    mockedPrisma.material.create.mockResolvedValue({
      id: 'mat_1',
      nombre: 'Cobre',
      precioPorLibra: 4.25,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const request = new Request('http://localhost/api/materials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'Cobre', precioPorLibra: 4.25 }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { ok: boolean; data: { nombre: string } };

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.nombre).toBe('Cobre');
    expect(mockedPrisma.material.create).toHaveBeenCalledTimes(1);
  });
});