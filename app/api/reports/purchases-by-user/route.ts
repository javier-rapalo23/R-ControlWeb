import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { parseBusinessDate } from '@/lib/business-date';
import type { PurchasesByUserRow } from '@/types/domain';

// Compras agrupadas por el usuario que las registró, entre `from` y `to` (inclusive).
// Se suma sobre los items (Purchase) para que el total cuadre con "Compras del día";
// las compras sin usuario (antiguas o sin transacción) quedan en una fila "Sin usuario".
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) {
      return failure('VALIDATION_ERROR', 'from y to son requeridos', 400);
    }

    const fromDate = parseBusinessDate(from);
    const toDate = parseBusinessDate(to);
    if (fromDate > toDate) {
      return failure('VALIDATION_ERROR', 'from no puede ser mayor que to', 400);
    }

    const purchases = await prisma.purchase.findMany({
      where: { businessDate: { gte: fromDate, lte: toDate } },
      select: {
        id: true,
        libras: true,
        total: true,
        purchaseTransactionId: true,
        purchaseTransaction: { select: { createdByUserId: true } },
      },
    });

    const groups = new Map<string | null, { compras: Set<string>; libras: number; total: number }>();
    for (const purchase of purchases) {
      const userId = purchase.purchaseTransaction?.createdByUserId ?? null;
      const group = groups.get(userId) ?? { compras: new Set<string>(), libras: 0, total: 0 };
      group.compras.add(purchase.purchaseTransactionId ?? purchase.id);
      group.libras += Number(purchase.libras);
      group.total += Number(purchase.total);
      groups.set(userId, group);
    }

    const userIds = [...groups.keys()].filter((id): id is string => id !== null);
    const users = userIds.length
      ? await prisma.user.findMany({ where: { userId: { in: userIds } }, select: { userId: true, nombre: true } })
      : [];
    const nameById = new Map(users.map((user) => [user.userId, user.nombre.trim()]));

    const rows: PurchasesByUserRow[] = [...groups.entries()]
      .map(([userId, group]) => ({
        userId,
        nombre: userId === null ? 'Sin usuario' : nameById.get(userId) || userId,
        compras: group.compras.size,
        libras: Math.round(group.libras * 100) / 100,
        total: Math.round(group.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, row) => ({
        compras: acc.compras + row.compras,
        libras: Math.round((acc.libras + row.libras) * 100) / 100,
        total: Math.round((acc.total + row.total) * 100) / 100,
      }),
      { compras: 0, libras: 0, total: 0 },
    );

    return success({ from, to, rows, totals });
  } catch (error) {
    return handleApiError(error);
  }
}
