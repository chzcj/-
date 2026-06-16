// Next.js instrumentation：模块加载即执行（不依赖探针请求），启动 job_queue poller。
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startJobPoller } = await import('@/lib/server/jobs/queue')
    startJobPoller()
  }
}
