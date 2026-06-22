import { ok, fail } from '@/lib/api-response'
import { verifyAdminApi, forbiddenError } from '@/lib/server/auth-guard'
import { loadAppSettings, saveAppSettings } from '@/lib/server/db'
import { encryptSecret, isEncryptionAvailable } from '@/lib/server/settings/crypto'
import { refreshSettings, getAIConfigStatus, type AppSettingsValue } from '@/lib/server/settings/runtime-config'
import { getCurrentUser } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

/* 管理员 AI 配置读写。GET 返回脱敏状态（key 仅末 4 位）；
   POST 增量合并写入（apiKey 留空=不改），key 经 AES-GCM 加密落库，写后 refreshSettings 即时生效。
   完整 key 绝不回传前端。 */
export async function GET(request: Request) {
  if (!(await verifyAdminApi(request))) return forbiddenError()
  return ok({ config: getAIConfigStatus(), encryptionAvailable: isEncryptionAvailable() })
}

export async function POST(request: Request) {
  if (!(await verifyAdminApi(request))) return forbiddenError()

  const body = await request.json().catch(() => ({}))
  const { fastAi, embedding } = body as {
    fastAi?: { apiKey?: string; baseUrl?: string; model?: string; temperature?: number }
    embedding?: { apiKey?: string; baseUrl?: string; model?: string }
  }

  // 留空 apiKey = 不改；要写 key 必须先配 SETTINGS_ENC_KEY（否则只能写 model/baseUrl）。
  const wantWriteKey = Boolean(fastAi?.apiKey || embedding?.apiKey)
  if (wantWriteKey && !isEncryptionAvailable()) {
    return fail(
      'ENC_KEY_MISSING',
      '要保存 API Key 需先在环境变量配置 SETTINGS_ENC_KEY（任意 32+ 字节随机串）。未配置时仍可保存 model / base_url。',
      undefined,
      400
    )
  }

  // 读现有 → 增量合并（未传字段保留）。
  const current = (await loadAppSettings()) as AppSettingsValue
  const next: AppSettingsValue = {
    fastAi: { ...current.fastAi },
    embedding: { ...current.embedding }
  }

  if (fastAi) {
    if (typeof fastAi.baseUrl === 'string') next.fastAi!.baseUrl = fastAi.baseUrl.trim()
    if (typeof fastAi.model === 'string') next.fastAi!.model = fastAi.model.trim()
    if (typeof fastAi.temperature === 'number' && Number.isFinite(fastAi.temperature)) {
      next.fastAi!.temperature = Math.min(2, Math.max(0, fastAi.temperature))
    }
    if (fastAi.apiKey && fastAi.apiKey.trim()) next.fastAi!.apiKeyEnc = encryptSecret(fastAi.apiKey.trim())
  }
  if (embedding) {
    if (typeof embedding.baseUrl === 'string') next.embedding!.baseUrl = embedding.baseUrl.trim()
    if (typeof embedding.model === 'string') next.embedding!.model = embedding.model.trim()
    if (embedding.apiKey && embedding.apiKey.trim()) next.embedding!.apiKeyEnc = encryptSecret(embedding.apiKey.trim())
  }

  await saveAppSettings(next as Record<string, unknown>)
  await refreshSettings() // 即时生效

  // 审计日志：记操作者与改动字段，绝不记 key 值。
  const user = await getCurrentUser()
  console.info(
    `[admin] AI 配置更新 by=${user?.phone || 'unknown'} fastAi=${JSON.stringify(Object.keys(fastAi || {}))} embedding=${JSON.stringify(Object.keys(embedding || {}))}`
  )

  return ok({ config: getAIConfigStatus() })
}
