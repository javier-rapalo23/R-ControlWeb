import { Prisma, PrismaClient } from '@prisma/client';
import { parseBusinessDate, toBusinessDateString } from '@/lib/business-date';
import type {
  CashMovementDTO,
  CashMovementTipo,
  DailyBalanceDTO,
  ExpenseDTO,
  LedgerDTO,
  PurchaseDTO,
  SaleDTO,
} from '@/types/domain';

type DbClient = PrismaClient | Prisma.TransactionClient;

export function decimalToNumber(value: Prisma.Decimal | number | string | null): number {
  if (value === null) {
    return 0;
  }

  return Number(value);
}

function mapBalance(balance: {
  id: string;
  businessDate: Date;
  saldoInicial: Prisma.Decimal;
  saldoActual: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}): DailyBalanceDTO {
  return {
    id: balance.id,
    businessDate: toBusinessDateString(balance.businessDate),
    saldoInicial: decimalToNumber(balance.saldoInicial),
    saldoActual: decimalToNumber(balance.saldoActual),
    createdAt: balance.createdAt.toISOString(),
    updatedAt: balance.updatedAt.toISOString(),
  };
}

function mapPurchase(purchase: {
  id: string;
  businessDate: Date;
  materialId: string;
  materialNombre: string;
  precioPorLibra: Prisma.Decimal;
  libras: Prisma.Decimal;
  total: Prisma.Decimal;
  createdAt: Date;
}): PurchaseDTO {
  return {
    id: purchase.id,
    businessDate: toBusinessDateString(purchase.businessDate),
    materialId: purchase.materialId,
    materialNombre: purchase.materialNombre,
    precioPorLibra: decimalToNumber(purchase.precioPorLibra),
    libras: decimalToNumber(purchase.libras),
    total: decimalToNumber(purchase.total),
    createdAt: purchase.createdAt.toISOString(),
  };
}

function mapSale(sale: {
  id: string;
  businessDate: Date;
  descripcion: string;
  monto: Prisma.Decimal;
  createdAt: Date;
}): SaleDTO {
  return {
    id: sale.id,
    businessDate: toBusinessDateString(sale.businessDate),
    descripcion: sale.descripcion,
    monto: decimalToNumber(sale.monto),
    createdAt: sale.createdAt.toISOString(),
  };
}

function mapExpense(expense: {
  id: string;
  businessDate: Date;
  categoria: string;
  descripcion: string;
  monto: Prisma.Decimal;
  createdAt: Date;
}): ExpenseDTO {
  return {
    id: expense.id,
    businessDate: toBusinessDateString(expense.businessDate),
    categoria: expense.categoria,
    descripcion: expense.descripcion,
    monto: decimalToNumber(expense.monto),
    createdAt: expense.createdAt.toISOString(),
  };
}

export function mapCashMovement(movement: {
  id: string;
  businessDate: Date;
  tipo: string;
  concepto: string;
  monto: Prisma.Decimal;
  createdAt: Date;
}): CashMovementDTO {
  return {
    id: movement.id,
    businessDate: toBusinessDateString(movement.businessDate),
    tipo: movement.tipo as CashMovementTipo,
    concepto: movement.concepto,
    monto: decimalToNumber(movement.monto),
    createdAt: movement.createdAt.toISOString(),
  };
}

export async function ensureDailyBalance(db: DbClient, businessDateInput: string) {
  const businessDate = parseBusinessDate(businessDateInput);

  return db.dailyBalance.upsert({
    where: { businessDate },
    update: {},
    create: {
      businessDate,
      saldoInicial: 0,
      saldoActual: 0,
    },
  });
}

export async function recalculateDailyBalance(db: DbClient, businessDateInput: string) {
  const businessDate = parseBusinessDate(businessDateInput);
  const balance = await ensureDailyBalance(db, businessDateInput);

  const [comprasAgg, ventasAgg, gastosAgg, movimientosAgg] = await Promise.all([
    db.purchase.aggregate({
      where: { businessDate },
      _sum: { total: true },
    }),
    db.sale.aggregate({
      where: { businessDate },
      _sum: { monto: true },
    }),
    db.expense.aggregate({
      where: { businessDate },
      _sum: { monto: true },
    }),
    db.cashMovement.groupBy({
      by: ['tipo'],
      where: { businessDate },
      _sum: { monto: true },
    }),
  ]);

  const totalCompras = decimalToNumber(comprasAgg._sum.total);
  const totalVentas = decimalToNumber(ventasAgg._sum.monto);
  const totalGastos = decimalToNumber(gastosAgg._sum.monto);
  const sumByTipo = (tipo: string) => decimalToNumber(movimientosAgg.find((row) => row.tipo === tipo)?._sum.monto ?? null);
  const totalIngresos = sumByTipo('ingreso');
  const totalSalidas = sumByTipo('salida');
  const saldoInicial = decimalToNumber(balance.saldoInicial);
  // Redondeo a centavos para no arrastrar errores de punto flotante.
  const saldoActual =
    Math.round((saldoInicial + totalVentas + totalIngresos - totalCompras - totalGastos - totalSalidas) * 100) / 100;

  const updated = await db.dailyBalance.update({
    where: { id: balance.id },
    data: { saldoActual },
  });

  return {
    balance: mapBalance(updated),
    totals: {
      totalCompras,
      totalVentas,
      totalGastos,
      totalIngresos,
      totalSalidas,
      saldoActual,
    },
  };
}

export async function getLedgerByDate(db: DbClient, businessDateInput: string): Promise<LedgerDTO> {
  const businessDate = parseBusinessDate(businessDateInput);
  await ensureDailyBalance(db, businessDateInput);
  const recalculated = await recalculateDailyBalance(db, businessDateInput);

  const [purchases, sales, expenses, cashMovements] = await Promise.all([
    db.purchase.findMany({ where: { businessDate }, orderBy: { createdAt: 'desc' } }),
    db.sale.findMany({ where: { businessDate }, orderBy: { createdAt: 'desc' } }),
    db.expense.findMany({ where: { businessDate }, orderBy: { createdAt: 'desc' } }),
    db.cashMovement.findMany({ where: { businessDate }, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    businessDate: toBusinessDateString(businessDate),
    balance: recalculated.balance,
    totals: recalculated.totals,
    purchases: purchases.map(mapPurchase),
    sales: sales.map(mapSale),
    expenses: expenses.map(mapExpense),
    cashMovements: cashMovements.map(mapCashMovement),
  };
}