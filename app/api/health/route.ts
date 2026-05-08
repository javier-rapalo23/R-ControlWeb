import { success } from '@/lib/api-response';

export async function GET() {
  return success({
    status: 'ok',
    service: 'r-control-api',
    timestamp: new Date().toISOString(),
  });
}