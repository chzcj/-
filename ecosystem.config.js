module.exports = {
  apps: [
    {
      name: 'yujian',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/ubuntu/apps/yujian',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
