// Next.js instrumentation：模块加载即执行（不依赖探针请求）。
// 启动 job_queue poller + LLM 预热，并打印「有效运行状态」横幅——
// 在 prod 误进 mock 模式 / key 缺失时大声告警，避免「看起来正常启动但数据进内存丢失 / AI 静默失效」这类隐形故障。
// 注意：动态 import 必须放在 `NEXT_RUNTIME === 'nodejs'` 块内（webpack 据此把 pg 等 node 依赖排除出 edge bundle）。
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startJobPoller } = await import('@/lib/server/jobs/queue')
    const { startFastAIWarmupLoop, isFastAIEnabled } = await import('@/lib/server/ark-agents')

    startJobPoller()
    const llmOn = isFastAIEnabled()
    if (llmOn) startFastAIWarmupLoop()

    // isDatabaseEnabled 的等价内联（避免 import db.ts 拉入 pg/fs）：DATABASE_URL 为 postgres + 非 mock 模式。
    const dbOn = Boolean(process.env.DATABASE_URL?.startsWith('postgres')) && process.env.NEXT_PUBLIC_USE_MOCK === 'false'
    const isProd = process.env.NODE_ENV === 'production'
    console.log(`[childos] 启动状态 · DB=${dbOn ? '持久化' : '进程内存(降级)'} · LLM=${llmOn ? '启用' : '未启用(规则降级)'} · ${isProd ? 'prod' : 'dev'}`)

    // prod 未启用持久化 DB：数据写进内存、重启丢失——最易被忽视的生产故障，大声告警。
    if (isProd && !dbOn) {
      console.error('[childos] ⚠️ 严重：NODE_ENV=production 但数据库未启用（DATABASE_URL 未配置或 NEXT_PUBLIC_USE_MOCK!=false）。用户数据将写进进程内存、重启全部丢失。生产部署必须在构建时带 NEXT_PUBLIC_USE_MOCK=false 并配置 DATABASE_URL。')
    }
    // LLM 未启用：所有 AI 功能走规则降级——若非有意，多半是 key 缺失/过期。
    if (isProd && !llmOn) {
      console.error('[childos] ⚠️ NODE_ENV=production 但 LLM 未启用（FAST_AI_API_KEY / FAST_AI_MODEL 未配置）。所有 AI 功能将走规则降级，请检查凭证。')
    }
  }
}
