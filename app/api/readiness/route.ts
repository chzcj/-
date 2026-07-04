import { requestId } from '@/lib/api-response';
import { isFastAIEnabled, startFastAIWarmupLoop } from '@/lib/server/ark-agents';
import { isEmbeddingEnabled } from '@/lib/server/memory/embedding';
import { startJobPoller, getGlobalJobBacklog, readWorkerHeartbeat } from '@/lib/server/jobs/queue';
import { debugDatabase, isDatabaseEnabled, isPgVectorEnabled } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// worker 健康阈值：心跳超过 3 轮 POLL_MS（默认 9s）视为 worker 未在动。
const WORKER_STALE_MS = Number(process.env.JOB_POLL_MS || 3000) * 3;

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

  // Job 监督指标：积压/死信/worker 心跳。web 关 poller 时 workerAlive 依赖独立 worker 进程心跳。
  const backlog = databaseReady ? await getGlobalJobBacklog().catch(() => undefined) : undefined;
  const heartbeat = databaseReady ? await readWorkerHeartbeat().catch(() => ({ at: null, ageMs: null })) : { at: null, ageMs: null };
  // workerConfigured：DB 启用时即期望有 worker 在跑（web 进程 poller 关闭由独立 worker 承担）。
  const workerConfigured = databaseReady;
  const workerAlive = heartbeat.ageMs !== null && heartbeat.ageMs < WORKER_STALE_MS;
  const jobBacklog = backlog ? (backlog.pending + backlog.retrying) : 0;
  const failedCount = backlog ? backlog.failed : 0;
  // 积压 > 50 或死信 > 10 或 worker 心跳过期 → job 不健康，ready=false（防「只入不出」静默故障）。
  const jobHealthy = backlog ? (jobBacklog <= 50 && failedCount <= 10 && workerAlive) : true;

  // ready 需含 embedding + vector + job 健康：否则会出现「系统 ready 但 ingestEpisodeStrict 因无 embedding key 直接 return、
  // facts/atoms 根本不抽取」或「memory_write 只入队不出，记忆永远不落库」的误导状态。
  const ready = fastConfigured && databaseReady && embeddingConfigured && vectorReady && jobHealthy;

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
      mockModeInProduction: process.env.NODE_ENV === 'production' && mockMode,
      jobs: {
        workerConfigured,
        workerAlive,
        heartbeatAt: heartbeat.at,
        heartbeatAgeMs: heartbeat.ageMs,
        pending: backlog?.pending ?? 0,
        retrying: backlog?.retrying ?? 0,
        failed: failedCount,
        jobHealthy,
      },
    },
    nextStep: ready
      ? '可以注册账号并测试完整流程。'
      : process.env.NODE_ENV === 'production'
        ? '系统还在准备中，请稍后再试。'
        : '请先补齐 .env.local：NEXT_PUBLIC_USE_MOCK=false、DATABASE_URL、FAST_AI_API_KEY、FAST_AI_MODEL、EMBEDDING_API_KEY（并确保 pgvector 扩展可用）。'
  };

  // 未就绪返回 503，使 K8s/负载均衡的 readinessProbe 能正确摘流（此前恒 200 让探针无感）。
  return Response.json(
    { ok: true, data, requestId: requestId() },
    { status: ready ? 200 : 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
