import { ok } from '@/lib/api-response';
import { isFastAIEnabled, startFastAIWarmupLoop } from '@/lib/server/ark-agents';
import { debugDatabase, isDatabaseEnabled } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  startFastAIWarmupLoop();
  const databaseConfigured = isDatabaseEnabled();
  const fastConfigured = isFastAIEnabled();
  const database = await debugDatabase().catch((error) => ({
    enabled: databaseConfigured,
    error: error instanceof Error ? error.message : 'DATABASE_CHECK_FAILED'
  }));
  const databaseReady = database.enabled === true && !('error' in database);
  const ready = fastConfigured && databaseReady;

  return ok({
    ready,
    checks: {
      databaseConfigured,
      database,
      fastConfigured,
      cookieSecure:
        process.env.AUTH_COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_SECURE !== 'false'),
      mockMode: process.env.NEXT_PUBLIC_USE_MOCK !== 'false'
    },
    nextStep:
      ready
        ? '可以注册账号并测试完整流程。'
        : '请先补齐 .env.local：NEXT_PUBLIC_USE_MOCK=false、DATABASE_URL、FAST_AI_API_KEY、FAST_AI_MODEL。'
  });
}
