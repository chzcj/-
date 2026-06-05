import { ok } from '@/lib/api-response';
import { isArkEnabled, isFastAIEnabled, startFastAIWarmupLoop } from '@/lib/server/ark-agents';
import { debugDatabase, isDatabaseEnabled } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  startFastAIWarmupLoop();
  const databaseConfigured = isDatabaseEnabled();
  const arkConfigured = isArkEnabled();
  const fastConfigured = isFastAIEnabled();
  const database = await debugDatabase().catch((error) => ({
    enabled: databaseConfigured,
    error: error instanceof Error ? error.message : 'DATABASE_CHECK_FAILED'
  }));

  return ok({
    ready: databaseConfigured && arkConfigured && database.enabled === true,
    checks: {
      databaseConfigured,
      database,
      arkConfigured,
      fastConfigured,
      cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
      mockMode: process.env.NEXT_PUBLIC_USE_MOCK !== 'false'
    },
    nextStep:
      databaseConfigured && arkConfigured && database.enabled === true
        ? '可以注册账号并测试完整流程。'
        : '请先补齐 .env.local：NEXT_PUBLIC_USE_MOCK=false、DATABASE_URL、AI_PROVIDER=ark、ARK_API_KEY、ARK_MODEL。'
  });
}
