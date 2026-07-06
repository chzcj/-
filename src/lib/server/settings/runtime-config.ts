import 'server-only'
import { loadAppSettings } from '@/lib/server/db'
import { decryptSecret } from '@/lib/server/settings/crypto'

/* ================================================================
   运行时 AI 配置层 — 「配置即时生效」的核心
   管理员在面板写入的配置存 app_settings（key 密文）。这里维护一份模块级 override
   （同步可读），由 refreshSettings() 从 DB 解密刷新。
   - getter 全同步：override ?? env ?? 默认 —— 不引发 isFastAIEnabled 的 async 连锁。
   - 写配置 API 成功后调 refreshSettings() → 立即生效，无需重启。
   - 读路径首次惰性触发一次后台刷新（ensureSettingsLoaded）。
   ================================================================ */

interface AIOverride {
  fastApiKey?: string; fastModel?: string; fastBase?: string; fastTemp?: number
  embApiKey?: string; embBase?: string; embModel?: string
}

let override: AIOverride = {}
let loaded = false

// app_settings.value 形状：{ fastAi:{apiKeyEnc,baseUrl,model,temperature}, embedding:{apiKeyEnc,baseUrl,model} }
export interface AppSettingsValue {
  fastAi?: { apiKeyEnc?: string; baseUrl?: string; model?: string; temperature?: number }
  embedding?: { apiKeyEnc?: string; baseUrl?: string; model?: string }
}

/** 从 app_settings 重载 override（解密 key）。启动时 + 写配置后调用。 */
export async function refreshSettings(): Promise<void> {
  try {
    const v = (await loadAppSettings()) as AppSettingsValue
    const next: AIOverride = {}
    if (v.fastAi) {
      if (v.fastAi.apiKeyEnc) { const k = decryptSecret(v.fastAi.apiKeyEnc); if (k) next.fastApiKey = k }
      if (v.fastAi.baseUrl) next.fastBase = v.fastAi.baseUrl.replace(/\/$/, '')
      if (v.fastAi.model) next.fastModel = v.fastAi.model
      if (typeof v.fastAi.temperature === 'number') next.fastTemp = v.fastAi.temperature
    }
    if (v.embedding) {
      if (v.embedding.apiKeyEnc) { const k = decryptSecret(v.embedding.apiKeyEnc); if (k) next.embApiKey = k }
      if (v.embedding.baseUrl) next.embBase = v.embedding.baseUrl.replace(/\/$/, '')
      if (v.embedding.model) next.embModel = v.embedding.model
    }
    override = next
    loaded = true
  } catch (err) {
    console.error('[settings] 加载 app_settings 失败，沿用 env 默认:', err)
  }
}

/** 首次惰性加载：不阻塞同步 getter（getter 先用 env，刷新完成后即生效）。 */
export function ensureSettingsLoaded(): void {
  if (loaded) return
  loaded = true
  void refreshSettings()
}

// ---- 同步 getter：override ?? env ?? 默认 ----
export function fastApiKey(): string { return override.fastApiKey ?? process.env.FAST_AI_API_KEY ?? '' }
export function fastModel(): string { return override.fastModel ?? process.env.FAST_AI_MODEL ?? 'deepseek-v4-flash' }
export function fastBase(): string {
  return (override.fastBase ?? process.env.FAST_AI_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/$/, '')
}
export function fastTemp(): number { return override.fastTemp ?? Number(process.env.FAST_AI_TEMPERATURE || 0.25) }

/** 家长可见前台：豆包 flash；未配置时回退 FAST_AI（单轨兼容）。 */
export function parentApiKey(): string {
  return process.env.PARENT_AI_API_KEY || process.env.ARK_API_KEY || fastApiKey()
}
export function parentModel(): string {
  return process.env.PARENT_AI_MODEL || 'ep-20260603000221-qp5h7'
}
export function parentBase(): string {
  return (process.env.PARENT_AI_BASE_URL || process.env.ARK_BASE_URL || fastBase()).replace(/\/$/, '')
}
export function parentTemp(): number { return Number(process.env.PARENT_AI_TEMPERATURE || fastTemp()) }

export function isParentAIEnabled(): boolean {
  ensureSettingsLoaded()
  return Boolean(parentApiKey() && parentModel())
}

export function embApiKey(): string {
  return override.embApiKey ?? process.env.EMBEDDING_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? ''
}
export function embBase(): string {
  return (override.embBase ?? process.env.EMBEDDING_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
}
export function embModel(): string { return override.embModel ?? process.env.EMBEDDING_MODEL ?? 'text-embedding-v3' }

/** admin 脱敏配置状态（绝不回传完整 key）。 */
function mask(key: string): string { return key ? `****${key.slice(-4)}` : '' }
export function getAIConfigStatus() {
  const fastFromDb = override.fastApiKey !== undefined
  const embFromDb = override.embApiKey !== undefined
  return {
    fastAi: {
      configured: Boolean(fastApiKey() && fastModel()),
      model: fastModel(),
      baseUrl: fastBase(),
      temperature: fastTemp(),
      apiKeyMasked: mask(fastApiKey()),
      apiKeySet: Boolean(fastApiKey()),
      source: fastFromDb ? 'db' : (process.env.FAST_AI_API_KEY ? 'env' : 'none')
    },
    embedding: {
      configured: Boolean(embApiKey() && embModel()),
      model: embModel(),
      baseUrl: embBase(),
      apiKeyMasked: mask(embApiKey()),
      apiKeySet: Boolean(embApiKey()),
      source: embFromDb ? 'db' : ((process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY) ? 'env' : 'none')
    }
  }
}
