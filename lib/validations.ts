import { z } from 'zod';

const businessDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'businessDate must use YYYY-MM-DD',
});

export const createMaterialSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  precioPorLibra: z.number().positive(),
});

export const setInitialBalanceSchema = z.object({
  businessDate: businessDateField,
  saldoInicial: z.number(),
});

export const createPurchaseSchema = z.object({
  businessDate: businessDateField,
  materialId: z.string().min(1),
  libras: z.number().positive(),
  precioPorLibra: z.number().positive().optional(),
});

export const createSaleSchema = z.object({
  businessDate: businessDateField,
  descripcion: z.string().trim().min(2).max(250),
  monto: z.number().positive(),
});

export const createExpenseSchema = z.object({
  businessDate: businessDateField,
  categoria: z.string().trim().min(2).max(80),
  descripcion: z.string().trim().min(2).max(250),
  monto: z.number().positive(),
});