import { failure, handleApiError, success } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { buildInventoryReport } from '@/lib/build-ticket';

export async function POST() {
  try {
    const { buffer, company } = await buildInventoryReport();

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
