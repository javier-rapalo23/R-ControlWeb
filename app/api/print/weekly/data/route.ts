import { failure, handleApiError, success } from '@/lib/api-response';
import { buildWeeklySummaryReport } from '@/lib/build-ticket';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) {
      return failure('VALIDATION_ERROR', 'from y to son requeridos', 400);
    }

    const { buffer } = await buildWeeklySummaryReport(from, to);
    return success({ payloadB64: buffer.toString('base64') });
  } catch (error) {
    return handleApiError(error);
  }
}
