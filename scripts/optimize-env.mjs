#!/usr/bin/env node
/**
 * 读取现有 .env.local，去掉废弃项，补齐生产推荐项，写回（不打印 secret）。
 * 用法：node scripts/optimize-env.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const envPath = path.join(root, '.env.local')

const DEPRECATED = new Set([
  'AI_PROVIDER',
  'ARK_API_KEY',
  'ARK_BASE_URL',
  'ARK_MODEL',
  'ARK_TEMPERATURE',
  'DB_PASSWORD',
])

function parseEnv(text) {
  const map = new Map()
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    map.set(t.slice(0, i).trim(), t.slice(i + 1).trim())
  }
  return map
}

const existing = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : new Map()

for (const k of DEPRECATED) existing.delete(k)

const get = (k, fallback = '') => existing.get(k) ?? fallback

const isProd = get('NODE_ENV') === 'production' || get('NEXT_PUBLIC_APP_ENV') === 'production'

const lines = [
  '# ChildOS 运行配置（勿提交 Git）',
  '# 生产部署：deploy.sh 会上传本文件到服务器',
  '',
  '# —— 运行模式 ——',
  `NODE_ENV=${get('NODE_ENV', 'production')}`,
  `NEXT_PUBLIC_APP_ENV=${get('NEXT_PUBLIC_APP_ENV', 'production')}`,
  `NEXT_PUBLIC_USE_MOCK=${get('NEXT_PUBLIC_USE_MOCK', 'false')}`,
  '',
  '# —— 主 LLM（OpenAI 兼容：DeepSeek / 其它）——',
  `FAST_AI_PROVIDER=${get('FAST_AI_PROVIDER', 'deepseek')}`,
  `FAST_AI_BASE_URL=${get('FAST_AI_BASE_URL', 'https://api.deepseek.com/v1')}`,
  `FAST_AI_MODEL=${get('FAST_AI_MODEL', 'deepseek-v4-flash')}`,
  `FAST_AI_API_KEY=${get('FAST_AI_API_KEY')}`,
  `FAST_AI_TEMPERATURE=${get('FAST_AI_TEMPERATURE', '0.25')}`,
  '',
  '# —— 向量检索（/api/readiness ready 必需；阿里百炼 text-embedding-v3）——',
  `EMBEDDING_API_KEY=${get('EMBEDDING_API_KEY', get('DASHSCOPE_API_KEY'))}`,
  `EMBEDDING_BASE_URL=${get('EMBEDDING_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')}`,
  `EMBEDDING_MODEL=${get('EMBEDDING_MODEL', 'text-embedding-v3')}`,
  '',
  '# —— PostgreSQL（需 pgvector 扩展）——',
  `DATABASE_URL=${get('DATABASE_URL')}`,
  `PG_POOL_MAX=${get('PG_POOL_MAX', '8')}`,
  '',
  '# —— 鉴权 ——',
  `# 建议 INTERNAL_API_TOKEN 使用独立随机串，勿与 FAST_AI_API_KEY 相同`,
  `INTERNAL_API_TOKEN=${get('INTERNAL_API_TOKEN', get('FAST_AI_API_KEY'))}`,
  `AUTH_COOKIE_SECURE=${get('AUTH_COOKIE_SECURE', isProd ? 'true' : 'false')}`,
  '',
  '# —— 腾讯云实时语音识别（语音转写；生产请用 npm run asr:start）——',
  `TENCENT_APPID=${get('TENCENT_APPID')}`,
  `TENCENT_SECRET_ID=${get('TENCENT_SECRET_ID')}`,
  `TENCENT_SECRET_KEY=${get('TENCENT_SECRET_KEY')}`,
  '',
  '# —— 可选 ——',
  `# ADMIN_PHONES=${get('ADMIN_PHONES')}`,
  `# DEMO_ADMIN=${get('DEMO_ADMIN', 'false')}`,
  `# SETTINGS_ENC_KEY=${get('SETTINGS_ENC_KEY')}`,
  `# JOB_POLLER=true`,
  '',
]

if (get('GITEE_PRIVATE_TOKEN')) {
  lines.splice(-2, 0, `GITEE_PRIVATE_TOKEN=${get('GITEE_PRIVATE_TOKEN')}`)
}

fs.writeFileSync(envPath, `${lines.join('\n')}\n`)
console.log('[optimize-env] 已写入 .env.local（已移除废弃项，补齐推荐项）')
if (!get('EMBEDDING_API_KEY') && !get('DASHSCOPE_API_KEY')) {
  console.warn('[optimize-env] ⚠️ 缺少 EMBEDDING_API_KEY：/api/readiness 的 ready 将为 false，记忆向量检索不可用')
}
