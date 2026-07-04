#!/usr/bin/env node
/**
 * 部署前环境自检（不打印 secret 值）
 * 用法：node scripts/validate-env.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const envPath = path.join(root, '.env.local')

function loadEnv(file) {
  const map = {}
  if (!fs.existsSync(file)) return map
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return map
}

const env = { ...process.env, ...loadEnv(envPath) }
const issues = []
const warns = []

const req = (k, label) => {
  if (!env[k]?.trim()) issues.push(`缺少 ${k}（${label}）`)
}

req('DATABASE_URL', 'PostgreSQL')
req('FAST_AI_API_KEY', '主 LLM')
req('FAST_AI_MODEL', '主 LLM 模型')
req('INTERNAL_API_TOKEN', '内部 API / deploy AUTH_TOKEN')

if (env.NEXT_PUBLIC_USE_MOCK !== 'false') {
  issues.push('NEXT_PUBLIC_USE_MOCK 必须为 false（生产/真实后端）')
}

if (!env.EMBEDDING_API_KEY?.trim() && !env.DASHSCOPE_API_KEY?.trim()) {
  issues.push('缺少 EMBEDDING_API_KEY（向量检索；/api/readiness ready 必需）')
}

if (env.NODE_ENV === 'production' && env.AUTH_COOKIE_SECURE !== 'true') {
  warns.push('生产环境建议 AUTH_COOKIE_SECURE=true（HTTPS 站点）')
}

if (env.INTERNAL_API_TOKEN && env.FAST_AI_API_KEY && env.INTERNAL_API_TOKEN === env.FAST_AI_API_KEY) {
  warns.push('INTERNAL_API_TOKEN 与 FAST_AI_API_KEY 相同，建议拆成独立随机串')
}

for (const dead of ['AI_PROVIDER', 'ARK_API_KEY', 'DB_PASSWORD']) {
  if (env[dead]?.trim()) warns.push(`废弃变量 ${dead} 可删除（代码已不再读取）`)
}

const asr = ['TENCENT_APPID', 'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY']
if (asr.some((k) => !env[k]?.trim())) {
  warns.push('腾讯云 ASR 未配齐：语音转写降级，打字仍可用')
}

console.log('=== ChildOS 环境自检 ===')
if (issues.length === 0) {
  console.log('✅ 必配项齐全')
} else {
  console.log('❌ 必配项问题：')
  issues.forEach((x) => console.log(`  - ${x}`))
}

if (warns.length) {
  console.log('⚠️ 建议：')
  warns.forEach((x) => console.log(`  - ${x}`))
}

process.exit(issues.length ? 1 : 0)
