import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { buildWeeklySummaryReport } from '@/lib/build-ticket';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const from = typeof body?.from === 'string' ? body.from : null;
    const to = typeof body?.to === 'string' ? body.to : null;
    if (!from || !to) {
      return failure('VALIDATION_ERROR', 'from y to son requeridos', 400);
    }

    const { buffer, company } = await buildWeeklySummaryReport(from, to);

    if (!company.printerIp) {
      return failure(
        'PRINTER_NOT_CONFIGURED',
        'No se ha configurado la IP de la impresora térmica. Ve a Mantenimiento > Empresa.',
        400,
      );
    }

    const job = await prisma.printJob.create({
      data: {
        printerIp: company.printerIp,
        printerPort: company.printerPort,
        payloadB64: buffer.toString('base64'),
      },
    });

    return success({ jobId: job.id, status: job.status });
  } catch (error) {
    return handleApiError(error);
  }
}
