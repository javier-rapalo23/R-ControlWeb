import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { ApiError, ApiResponse, ApiSuccess } from '@/types/api';

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

export function handleApiError(error: unknown): NextResponse<ApiError> {
  if (error instanceof ZodError) {
    return failure('VALIDATION_ERROR', 'Invalid request payload', 400, error.flatten());
  }

  if (error instanceof Error) {
    return failure('BAD_REQUEST', error.message, 400);
  }

  return failure('INTERNAL_ERROR', 'Unexpected server error', 500);
}