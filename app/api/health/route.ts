import { ok } from '@/lib/api-response';
import { startFastAIWarmupLoop } from '@/lib/server/ark-agents';
import { debugStore } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  startFastAIWarmupLoop();
  return ok({
    status: 'ok',
    app: 'childos-mvp',
    mock: process.env.NEXT_PUBLIC_USE_MOCK !== 'false',
    store: await debugStore()
  });
}
