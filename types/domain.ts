export type MaterialDTO = {
  id: string;
  nombre: string;
  precioPorLibra: number;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseDTO = {
  id: string;
  businessDate: string;
  materialId: string;
  materialNombre: string;
  precioPorLibra: number;
  libras: number;
  total: number;
  createdAt: string;
};

export type SaleDTO = {
  id: string;
  businessDate: string;
  descripcion: string;
  monto: number;
  createdAt: string;
};

export type ExpenseDTO = {
  id: string;
  businessDate: string;
  categoria: string;
  descripcion: string;
  monto: number;
  createdAt: string;
};

export type DailyBalanceDTO = {
  id: string;
  businessDate: string;
  saldoInicial: number;
  saldoActual: number;
  createdAt: string;
  updatedAt: string;
};

export type LedgerDTO = {
  businessDate: string;
  balance: DailyBalanceDTO;
  totals: {
    totalCompras: number;
    totalVentas: number;
    totalGastos: number;
    saldoActual: number;
  };
  purchases: PurchaseDTO[];
  sales: SaleDTO[];
  expenses: ExpenseDTO[];
};