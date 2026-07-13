module.exports = {
  apps: [
    {
      name: 'yujian',
      // 生产需 ASR WebSocket：用 server.js（npm run asr:start），勿用裸 next start
      script: 'server.js',
      cwd: '/home/ubuntu/apps/yujian',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        // web 进程不跑 job poller，避免 AI 任务拖慢请求；后台 job 由 yujian-jobs worker 承担。
        CHILDOS_ENABLE_JOB_POLLER: 'false',
      },
      instances: 1,
      exec_mode: 'fork',
    },
    {
      // 独立 job worker：同一 server.js（复用编译产物与 handler），仅跑 poller，不暴露公网。
      // 端口必须避开 web(3000)，选高位未占用端口；HTTP 不被外部访问。
      name: 'yujian-jobs',
      script: 'server.js',
      cwd: '/home/ubuntu/apps/yujian',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
        HOSTNAME: '127.0.0.1',
        CHILDOS_ENABLE_JOB_POLLER: 'true',
      },
      instances: 1,
      exec_mode: 'fork',
    },
  ]
}
