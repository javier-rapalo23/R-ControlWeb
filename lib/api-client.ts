import type { ApiResponse } from '@/types/api';

export async function parseApiResponse<T>(response: Response): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(`El servidor respondió con un error (${response.status})`);
  }
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

// Texto para mostrar en un toast a partir de cualquier error capturado.
export function errorMessage(err: unknown, fallback = 'Intente de nuevo.'): string {
  // fetch lanza TypeError cuando no hay conexión con el servidor.
  if (err instanceof TypeError) return 'No hay conexión con el servidor. Intente de nuevo.';
  return err instanceof Error && err.message ? err.message : fallback;
}

export const PRINTER_TIMEOUT_MESSAGE =
  'La impresora no respondió a tiempo. Verifica que esté encendida y conectada a la red.';
