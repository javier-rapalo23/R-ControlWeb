import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import type { ApiError, ApiResponse, ApiSuccess } from '@/types/api';

// Mensajes de validación en español para todo lo que pase por handleApiError.
z.config(z.locales.es());

export function success<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data } satisfies ApiResponse<T>, { status });
}

export function failure(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, details },
    } satisfies ApiError,
    { status },
  );
}

function describeZodError(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join(' · ');
}

const prismaMessages: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: 'CONFLICT', message: 'Ya existe un registro con esos datos' },
  P2003: { status: 409, code: 'CONFLICT', message: 'El registro está relacionado con otros datos y no se puede modificar' },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'El registro no existe o ya fue eliminado' },
};

export function handleApiError(error: unknown): NextResponse<ApiError> {
  if (error instanceof ZodError) {
    return failure('VALIDATION_ERROR', describeZodError(error), 400, error.flatten());
  }

  // Los errores de Prisma traen detalles internos (consultas, columnas) que no deben llegar al usuario.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const known = prismaMessages[error.code];
    if (known) {
      return failure(known.code, known.message, known.status);
    }
    console.error(error);
    return failure('DATABASE_ERROR', 'Ocurrió un error al guardar en la base de datos', 500);
  }

  if (
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error(error);
    return failure('DATABASE_ERROR', 'Ocurrió un error al guardar en la base de datos', 500);
  }

  if (error instanceof SyntaxError) {
    return failure('BAD_REQUEST', 'La solicitud no tiene un formato válido', 400);
  }

  if (error instanceof Error) {
    return failure('BAD_REQUEST', error.message, 400);
  }

  return failure('INTERNAL_ERROR', 'Ocurrió un error inesperado', 500);
}
