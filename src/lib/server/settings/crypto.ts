import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

/* ================================================================
   配置密钥加密 — AES-256-GCM
   管理员在面板写入的 AI key 必须密文落库，绝不存明文。
   密钥来自 SETTINGS_ENC_KEY（env）：sha256 派生 32 字节，运维者给任意强随机串即可。
   ================================================================ */

function encKey(): Buffer | undefined {
  const raw = process.env.SETTINGS_ENC_KEY || ''
  if (!raw) return undefined
  // 统一 sha256 → 32B，不强求精确 32 字节编码，简化运维。
  return createHash('sha256').update(raw).digest()
}

/** 是否已配置加密密钥；未配置则不允许写 key（仅允许写非敏感项）。 */
export function isEncryptionAvailable(): boolean {
  return Boolean(process.env.SETTINGS_ENC_KEY)
}

/** AES-256-GCM 加密；输出 base64(iv[12] | tag[16] | ciphertext)。无 SETTINGS_ENC_KEY 抛错。 */
export function encryptSecret(plain: string): string {
  const key = encKey()
  if (!key) throw new Error('SETTINGS_ENC_KEY_MISSING')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/** 解密 encryptSecret 的输出；key 变更/密文损坏时返回空串（调用方据此降级到 env）。 */
export function decryptSecret(payload: string): string {
  const key = encKey()
  if (!key || !payload) return ''
  try {
    const buf = Buffer.from(payload, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}
