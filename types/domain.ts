export type MaterialDTO = {
  id: string;
  nombre: string;
  precioPorLibra: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientDTO = {
  id: string;
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
  rtn?: string | null;
  cuentaBancaria?: string | null;
  notas?: string | null;
  esGeneral: boolean;
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
  purchaseTransactionId?: string | null;
  createdAt: string;
};

export type PurchaseTransactionItemDTO = PurchaseDTO;

export type PurchaseTransactionDTO = {
  id: string;
  businessDate: string;
  clientId: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  client: ClientDTO;
  items: PurchaseTransactionItemDTO[];
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

export type CompanySettingsDTO = {
  id: string;
  nombre: string;
  rtn: string;
  telefono: string;
  direccion: string;
  email: string;
  printerIp: string;
  printerPort: number;
  updatedAt: string;
};

export type UserDTO = {
  id: string;
  userId: string;
  nombre: string;
  role: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MaterialCargaDTO = {
  id: string;
  businessDate: string;
  materialId: string;
  materialNombre: string;
  libras: number | null;
  descripcion: string | null;
  createdAt: string;
};

export type MaterialStockDTO = {
  materialId: string;
  totalLibras: number;
  daily: { businessDate: string; libras: number }[];
  purchases: PurchaseDTO[];
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

export type EmployeeDTO = {
  id: string;
  nombre: string;
  puesto: string | null;
  telefono: string | null;
  salarioDiario: number;
  fechaIngreso: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceDTO = {
  id: string;
  businessDate: string;
  employeeId: string;
  employeeNombre: string;
  horaEntrada: string;
  horaSalida: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeAdvanceDTO = {
  id: string;
  businessDate: string;
  employeeId: string;
  employeeNombre: string;
  monto: number;
  montoAplicado: number;
  pendiente: number;
  descripcion: string | null;
  expenseId: string | null;
  createdAt: string;
};

export type EmployeePaymentTipo = 'manual' | 'planilla';

export type EmployeePaymentDTO = {
  id: string;
  businessDate: string;
  employeeId: string;
  employeeNombre: string;
  tipo: EmployeePaymentTipo;
  monto: number;
  descripcion: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  diasTrabajados: number | null;
  subtotal: number | null;
  adelantosAplicados: number | null;
  expenseId: string | null;
  createdAt: string;
};

export type PayrollRowDTO = {
  employeeId: string;
  employeeNombre: string;
  salarioDiario: number;
  diasTrabajados: number;
  subtotal: number;
  adelantosPendientes: number;
  adelantosAplicables: number;
  neto: number;
  payment: EmployeePaymentDTO | null;
};

export type PayrollDTO = {
  periodoInicio: string;
  periodoFin: string;
  rows: PayrollRowDTO[];
};
