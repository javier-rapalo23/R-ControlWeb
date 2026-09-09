import { handleApiError, success } from '@/lib/api-response';
import { buildInventoryReport } from '@/lib/build-ticket';

export async function GET() {
  try {
    const { buffer } = await buildInventoryReport();
    return success({ payloadB64: buffer.toString('base64') });
  } catch (error) {
    return handleApiError(error);
  }
}
