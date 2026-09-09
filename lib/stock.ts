import { prisma } from '@/lib/prisma';

type StockEvent = {
  materialId: string;
  businessDate: Date;
  createdAt: Date;
  kind: 'purchase' | 'carga';
  libras: number | null;
};

/**
 * Current stock per material = compras acumuladas menos envíos a venta
 * (cargas), procesados en el orden en que ocurrieron. Una carga sin libras
 * especificadas significa "se envió todo lo que había" y reinicia el saldo a 0.
 *
 * Pass a materialId to scope to a single material, or omit it to compute the
 * balance for every material in one pass (two queries total instead of N).
 */
export async function computeCurrentStock(materialId?: string): Promise<Map<string, number>> {
  const where = materialId ? { materialId } : undefined;

  const [purchases, cargas] = await Promise.all([
    prisma.purchase.findMany({ where, orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }] }),
    prisma.materialCarga.findMany({ where, orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }] }),
  ]);

  const events: StockEvent[] = [
    ...purchases.map((p): StockEvent => ({
      materialId: p.materialId,
      businessDate: p.businessDate,
      createdAt: p.createdAt,
      kind: 'purchase',
      libras: Number(p.libras),
    })),
    ...cargas.map((c): StockEvent => ({
      materialId: c.materialId,
      businessDate: c.businessDate,
      createdAt: c.createdAt,
      kind: 'carga',
      libras: c.libras !== null ? Number(c.libras) : null,
    })),
  ].sort((a, b) => a.businessDate.getTime() - b.businessDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime());

  const balances = new Map<string, number>();
  for (const event of events) {
    const current = balances.get(event.materialId) ?? 0;
    if (event.kind === 'purchase') {
      balances.set(event.materialId, current + (event.libras ?? 0));
    } else if (event.libras !== null) {
      balances.set(event.materialId, current - event.libras);
    } else {
      balances.set(event.materialId, 0);
    }
  }

  return balances;
}
