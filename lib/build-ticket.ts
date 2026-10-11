import { prisma } from '@/lib/prisma';
import { parseBusinessDate, toBusinessDateString, todayBusinessDate } from '@/lib/business-date';
import { buildTicketBuffer, buildSummaryBuffer, buildInventoryBuffer, buildWeeklySummaryBuffer } from '@/lib/thermal-printer';
import { getLedgerByDate } from '@/lib/ledger';
import { computeCurrentStock } from '@/lib/stock';

export async function buildTicketForTransaction(transactionId: string) {
  const [transaction, company] = await Promise.all([
    prisma.purchaseTransaction.findUnique({
      where: { id: transactionId },
      include: { client: true, items: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    }),
  ]);

  if (!transaction) {
    return null;
  }

  const buffer = buildTicketBuffer({
    company: {
      nombre: company.nombre,
      rtn: company.rtn,
      telefono: company.telefono,
      direccion: company.direccion,
    },
    businessDate: toBusinessDateString(transaction.businessDate),
    clientNombre: transaction.client.nombre,
    items: transaction.items.map((item) => ({
      materialNombre: item.materialNombre,
      libras: Number(item.libras),
      precioPorLibra: Number(item.precioPorLibra),
      total: Number(item.total),
    })),
    total: Number(transaction.total),
  });

  return { buffer, company };
}

export async function buildSummaryForDate(businessDate: string) {
  const [company, ledger] = await Promise.all([
    prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    }),
    getLedgerByDate(prisma, businessDate),
  ]);

  const byMaterial: Record<string, { materialNombre: string; libras: number; total: number }> = {};
  for (const p of ledger.purchases) {
    if (!byMaterial[p.materialId]) byMaterial[p.materialId] = { materialNombre: p.materialNombre, libras: 0, total: 0 };
    byMaterial[p.materialId].libras += p.libras;
    byMaterial[p.materialId].total += p.total;
  }

  const buffer = buildSummaryBuffer({
    company: {
      nombre: company.nombre,
      rtn: company.rtn,
      telefono: company.telefono,
      direccion: company.direccion,
    },
    businessDate: ledger.businessDate,
    materials: Object.values(byMaterial).sort((a, b) => b.total - a.total),
    totalCompras: ledger.totals.totalCompras,
    totalVentas: ledger.totals.totalVentas,
    totalGastos: ledger.totals.totalGastos,
    totalIngresos: ledger.totals.totalIngresos,
    totalSalidas: ledger.totals.totalSalidas,
    saldoInicial: ledger.balance.saldoInicial,
    saldoActual: ledger.totals.saldoActual,
  });

  return { buffer, company };
}

export async function buildInventoryReport() {
  const [company, materials] = await Promise.all([
    prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    }),
    prisma.material.findMany(),
  ]);

  const balances = await computeCurrentStock();
  const materialsData = materials
    .map((m) => ({ materialNombre: m.nombre, libras: balances.get(m.id) ?? 0 }))
    .sort((a, b) => b.libras - a.libras);

  const buffer = buildInventoryBuffer({
    company: {
      nombre: company.nombre,
      rtn: company.rtn,
      telefono: company.telefono,
      direccion: company.direccion,
    },
    generatedAt: todayBusinessDate(),
    materials: materialsData,
  });

  return { buffer, company };
}

export async function buildWeeklySummaryReport(from: string, to: string) {
  const [company, purchases] = await Promise.all([
    prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    }),
    prisma.purchase.findMany({
      where: { businessDate: { gte: parseBusinessDate(from), lte: parseBusinessDate(to) } },
      orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const byMaterial: Record<string, { materialNombre: string; libras: number; total: number }> = {};
  for (const p of purchases) {
    if (!byMaterial[p.materialId]) byMaterial[p.materialId] = { materialNombre: p.materialNombre, libras: 0, total: 0 };
    byMaterial[p.materialId].libras += Number(p.libras);
    byMaterial[p.materialId].total += Number(p.total);
  }

  const buffer = buildWeeklySummaryBuffer({
    company: {
      nombre: company.nombre,
      rtn: company.rtn,
      telefono: company.telefono,
      direccion: company.direccion,
    },
    weekStart: from,
    weekEnd: to,
    materials: Object.values(byMaterial).sort((a, b) => b.total - a.total),
  });

  return { buffer, company };
}
