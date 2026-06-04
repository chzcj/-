import { ok } from '@/lib/api-response';
import { debugStore } from '@/lib/server/store';

export async function GET() {
  return ok({
    status: 'ok',
    app: 'childos-mvp',
    mock: process.env.NEXT_PUBLIC_USE_MOCK !== 'false',
    store: debugStore()
  });
}
