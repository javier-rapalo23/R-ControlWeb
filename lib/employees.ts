import { Prisma } from '@prisma/client';
import { toBusinessDateString } from '@/lib/business-date';
import { decimalToNumber } from '@/lib/ledger';
import type {
  AttendanceDTO,
  EmployeeAdvanceDTO,
  EmployeeDTO,
  EmployeePaymentDTO,
  EmployeePaymentTipo,
  SucursalDTO,
} from '@/types/domain';

export function mapSucursal(sucursal: {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SucursalDTO {
  return {
    ...sucursal,
    createdAt: sucursal.createdAt.toISOString(),
    updatedAt: sucursal.updatedAt.toISOString(),
  };
}

export const employeeInclude = { sucursal: { select: { nombre: true } } } as const;

export function mapEmployee(employee: {
  id: string;
  sucursalId: string;
  nombre: string;
  puesto: string | null;
  telefono: string | null;
  salarioDiario: Prisma.Decimal;
  fechaIngreso: Date;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  sucursal: { nombre: string };
}): EmployeeDTO {
  return {
    id: employee.id,
    sucursalId: employee.sucursalId,
    sucursalNombre: employee.sucursal.nombre,
    nombre: employee.nombre,
    puesto: employee.puesto,
    telefono: employee.telefono,
    salarioDiario: decimalToNumber(employee.salarioDiario),
    fechaIngreso: toBusinessDateString(employee.fechaIngreso),
    activo: employee.activo,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}

export const attendanceInclude = { employee: { select: { nombre: true } } } as const;

export function mapAttendance(attendance: {
  id: string;
  businessDate: Date;
  employeeId: string;
  horaEntrada: string;
  horaSalida: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: { nombre: string };
}): AttendanceDTO {
  return {
    id: attendance.id,
    businessDate: toBusinessDateString(attendance.businessDate),
    employeeId: attendance.employeeId,
    employeeNombre: attendance.employee.nombre,
    horaEntrada: attendance.horaEntrada,
    horaSalida: attendance.horaSalida,
    createdAt: attendance.createdAt.toISOString(),
    updatedAt: attendance.updatedAt.toISOString(),
  };
}

export const movementInclude = {
  employee: { select: { nombre: true } },
  sucursal: { select: { nombre: true } },
} as const;

export function mapAdvance(advance: {
  id: string;
  businessDate: Date;
  employeeId: string;
  sucursalId: string;
  monto: Prisma.Decimal;
  montoAplicado: Prisma.Decimal;
  descripcion: string | null;
  expenseId: string | null;
  createdAt: Date;
  employee: { nombre: string };
  sucursal: { nombre: string };
}): EmployeeAdvanceDTO {
  const monto = decimalToNumber(advance.monto);
  const montoAplicado = decimalToNumber(advance.montoAplicado);
  return {
    id: advance.id,
    businessDate: toBusinessDateString(advance.businessDate),
    employeeId: advance.employeeId,
    employeeNombre: advance.employee.nombre,
    sucursalId: advance.sucursalId,
    sucursalNombre: advance.sucursal.nombre,
    monto,
    montoAplicado,
    pendiente: fromCents(toCents(monto) - toCents(montoAplicado)),
    descripcion: advance.descripcion,
    expenseId: advance.expenseId,
    createdAt: advance.createdAt.toISOString(),
  };
}

export function mapPayment(payment: {
  id: string;
  businessDate: Date;
  employeeId: string;
  sucursalId: string;
  tipo: string;
  monto: Prisma.Decimal;
  descripcion: string | null;
  periodoInicio: Date | null;
  periodoFin: Date | null;
  diasTrabajados: number | null;
  subtotal: Prisma.Decimal | null;
  adelantosAplicados: Prisma.Decimal | null;
  expenseId: string | null;
  createdAt: Date;
  employee: { nombre: string };
  sucursal: { nombre: string };
}): EmployeePaymentDTO {
  return {
    id: payment.id,
    businessDate: toBusinessDateString(payment.businessDate),
    employeeId: payment.employeeId,
    employeeNombre: payment.employee.nombre,
    sucursalId: payment.sucursalId,
    sucursalNombre: payment.sucursal.nombre,
    tipo: payment.tipo as EmployeePaymentTipo,
    monto: decimalToNumber(payment.monto),
    descripcion: payment.descripcion,
    periodoInicio: payment.periodoInicio ? toBusinessDateString(payment.periodoInicio) : null,
    periodoFin: payment.periodoFin ? toBusinessDateString(payment.periodoFin) : null,
    diasTrabajados: payment.diasTrabajados,
    subtotal: payment.subtotal === null ? null : decimalToNumber(payment.subtotal),
    adelantosAplicados: payment.adelantosAplicados === null ? null : decimalToNumber(payment.adelantosAplicados),
    expenseId: payment.expenseId,
    createdAt: payment.createdAt.toISOString(),
  };
}

// El dinero se opera en centavos enteros para no acumular errores de punto flotante.
export function toCents(value: Prisma.Decimal | number): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() === '' ? null : value.trim();
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
