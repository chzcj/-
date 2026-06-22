import { ok } from '@/lib/api-response'
import { verifyAdminApi, forbiddenError } from '@/lib/server/auth-guard'
import { isDatabaseEnabled, isPgVectorEnabled, debugDatabase, countAtomsAndEpisodes } from '@/lib/server/db'
import { isFastAIEnabled } from '@/lib/server/ark-agents'
import { isEmbeddingEnabled } from '@/lib/server/memory/embedding'
import { getGlobalJobHealth } from '@/lib/server/jobs/queue'
import { getAIConfigStatus } from '@/lib/server/settings/runtime-config'

export const dynamic = 'force-dynamic'

/* 管理员后台观察聚合：系统健康 + 业务统计 + 后台任务队列 + AI 配置状态。
   全程 verifyAdminApi 守卫；复用 readiness/debugDatabase/getGlobalJobHealth 等现成探针。 */
export async function GET(request: Request) {
  if (!(await verifyAdminApi(request))) return forbiddenError()

  const databaseConfigured = isDatabaseEnabled()
  const database = await debugDatabase().catch((e) => ({
    enabled: databaseConfigured,
    error: e instanceof Error ? e.message : 'DB_CHECK_FAILED'
  }))
  const databaseReady = database.enabled === true && !('error' in database)
  const vectorReady = databaseReady ? await isPgVectorEnabled().catch(() => false) : false
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK !== 'false'

  const [vectorCounts, jobs] = await Promise.all([
    countAtomsAndEpisodes().catch(() => ({ factAtoms: 0, evidenceEpisodes: 0 })),
    getGlobalJobHealth().catch(() => undefined)
  ])

  return ok({
    system: {
      databaseConfigured,
      databaseReady,
      vectorReady,
      fastConfigured: isFastAIEnabled(),
      embeddingConfigured: isEmbeddingEnabled(),
      mockMode,
      mockModeInProduction: process.env.NODE_ENV === 'production' && mockMode,
      cookieSecure:
        process.env.AUTH_COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_SECURE !== 'false'),
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    business: { ...database, ...vectorCounts },
    jobs: jobs || { byType: {}, totals: { pending: 0, running: 0, retrying: 0, succeeded: 0, failed: 0 }, recentFailures: [] },
    ai: getAIConfigStatus()
  })
}
