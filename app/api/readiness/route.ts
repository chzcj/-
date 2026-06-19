import { requestId } from '@/lib/api-response';
import { isFastAIEnabled, startFastAIWarmupLoop } from '@/lib/server/ark-agents';
import { isEmbeddingEnabled } from '@/lib/server/memory/embedding';
import { startJobPoller } from '@/lib/server/jobs/queue';
import { debugDatabase, isDatabaseEnabled, isPgVectorEnabled } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  startFastAIWarmupLoop();
  startJobPoller();
  const databaseConfigured = isDatabaseEnabled();
  const fastConfigured = isFastAIEnabled();
  const embeddingConfigured = isEmbeddingEnabled();
  const database = await debugDatabase().catch((error) => ({
    enabled: databaseConfigured,
    error: error instanceof Error ? error.message : 'DATABASE_CHECK_FAILED'
  }));
  const databaseReady = database.enabled === true && !('error' in database);
  // pgvector 扩展状态：DB 启用时单独探测——pgvector 缺失会让语义检索静默降级到应用层 cosine，
  // 不暴露则管理员无从察觉「检索其实退化了」。
  const vectorReady = databaseReady ? await isPgVectorEnabled().catch(() => false) : false;
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
  // ready 需含 embedding + vector：否则会出现「系统 ready 但 ingestEpisodeStrict 因无 embedding key 直接 return、
  // facts/atoms 根本不抽取」的误导状态（三层语义检索是核心能力）。
  const ready = fastConfigured && databaseReady && embeddingConfigured && vectorReady;

  const data = {
    ready,
    checks: {
      databaseConfigured,
      database,
      vectorReady,
      fastConfigured,
      embeddingConfigured,
      cookieSecure:
        process.env.AUTH_COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_SECURE !== 'false'),
      mockMode,
      // prod 误进 mock 模式：数据进内存重启丢失（最易忽视的生产故障）。
      mockModeInProduction: process.env.NODE_ENV === 'production' && mockMode
    },
    nextStep:
      ready
        ? '可以注册账号并测试完整流程。'
        : '请先补齐 .env.local：NEXT_PUBLIC_USE_MOCK=false、DATABASE_URL、FAST_AI_API_KEY、FAST_AI_MODEL、EMBEDDING_API_KEY（并确保 pgvector 扩展可用）。'
  };

  // 未就绪返回 503，使 K8s/负载均衡的 readinessProbe 能正确摘流（此前恒 200 让探针无感）。
  return Response.json({ ok: true, data, requestId: requestId() }, { status: ready ? 200 : 503 });
}
