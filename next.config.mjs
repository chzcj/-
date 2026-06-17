/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 部署用 `next start`（pm2 fork，见 ecosystem.config.js），与 output:'standalone' 不兼容，故不启用 standalone。
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
