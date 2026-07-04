import 'server-only'

/** 家长可见文案禁止词（SP 第二道保险） */
const BANNED =
  /待验证|反证|旧判断|旧机制|旧理解|模型复核|置信度|写入记忆|写入观察|检索结果|机制信号|证据网络|观察记录|后台|模式能对上|标记为|不一致处|测试支持重点|系统会在后续|判断有更新|需要重新验证|硬套旧解释|前面的判断|之前的理解|profile_update|counter_evidence|new_mechanism|pending_hypothesis|matchedMechanism|model_review|memory_write|控制欲强|过度焦虑|沟通方式有问题|您是在连续追问|您这样会让孩子/i

const PLACEHOLDER = /测试画像|生命周期测试|从服务器记录恢复|家庭画像已从服务器记录恢复/i

export function assertParentFacingText(text: string, field: string): string {
  const t = text.trim()
  if (!t) throw new Error(`PARENT_FACING_EMPTY:${field}`)
  if (BANNED.test(t) || PLACEHOLDER.test(t)) {
    throw new Error(`PARENT_FACING_BANNED:${field}`)
  }
  return t
}

export function filterParentFacingText(text: string): string {
  let t = text.trim()
  if (!t) return t
  if (PLACEHOLDER.test(t)) throw new Error('PARENT_FACING_PLACEHOLDER')
  if (BANNED.test(t)) throw new Error('PARENT_FACING_BANNED')
  return t
}

export function filterParentFacingList(items: string[], field: string): string[] {
  const out: string[] = []
  for (const raw of items) {
    const t = raw.trim()
    if (!t) continue
    out.push(assertParentFacingText(t, field))
    if (out.length >= 5) break
  }
  if (!out.length) throw new Error(`PARENT_FACING_EMPTY_LIST:${field}`)
  return out
}
