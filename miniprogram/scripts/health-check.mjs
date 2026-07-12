#!/usr/bin/env node
/**
 * 小程序 + BFF 健康检查（本地 CI / 开工前）
 * 用法：node miniprogram/scripts/health-check.mjs
 */
const API_BASE = process.env.YUJIAN_API_BASE || 'https://yujian.yihe.site'

async function checkReadiness() {
  try {
    const res = await fetch(`${API_BASE}/api/readiness`)
    const json = await res.json()
    const ok = res.ok && json.ready !== undefined
    console.log(ok ? '✓' : '✗', 'readiness', JSON.stringify(json))
    return ok
  } catch (e) {
    console.log('✗', 'readiness', e.message)
    return false
  }
}

async function checkAsrTokenHint() {
  try {
    const res = await fetch(`${API_BASE}/api/asr/token`, { method: 'GET' })
    const text = await res.text()
    const unconfigured = /ASR_UNCONFIGURED/.test(text)
    const hasWs = /wss:\/\/asr\.cloud\.tencent\.com/.test(text)
    const engineOk = /16k_zh[^_]/.test(text) || /engine_model_type=16k_zh[^_]/.test(text)
    console.log(
      unconfigured ? '⚠' : hasWs ? '✓' : '✗',
      'asr/token',
      unconfigured ? 'ASR_UNCONFIGURED（需登录或服务端密钥）' : hasWs ? 'wsUrl 格式正常' : '异常响应'
    )
    if (hasWs && !engineOk) {
      console.log('⚠', 'asr/token', '请确认 engine 为 16k_zh（非 large）')
    }
    return !unconfigured || res.status === 401
  } catch (e) {
    console.log('✗', 'asr/token', e.message)
    return false
  }
}

async function main() {
  console.log('育见 health-check →', API_BASE)
  const a = await checkReadiness()
  const b = await checkAsrTokenHint()
  console.log('\n提示：语音 ASR 真机验收见 miniprogram/docs/M9-DEVICE-QA.md')
  console.log('小程序编译：cd miniprogram && npm run build:weapp')
  process.exit(a && b ? 0 : 1)
}

main()
