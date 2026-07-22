/**
 * v4 harness：后台建模 Agent 的落库前确定性校验（非 LLM）
 *
 * post-gate.ts 只护前台 prose；本模块补上后台缺口——
 * mechanismSynthesizer / portraitSynthesizer 的 JSON 产出在落库前经过：
 * 1. 可修复违规 → 代码直接钳制/降级（clamp，不打回）
 * 2. 结构性违规 → 标记 retryable，由调用方带违规反馈重试一次
 *
 * 原则：宁可降级落库也不让整条 Job 失败（深度复核成本高，空转比降级更伤）。
 */

import type { CandidateMechanism } from '@/types/database'
import type { FamilyUnderstandingDossier, DossierFactor } from '@/types/family-understanding-dossier'

export interface GateViolation {
  code: string
  detail: string
  /** true = 需要 LLM 重试修正；false = 代码已自动修复 */
  retryable: boolean
}

export interface GateResult<T> {
  fixed: T
  violations: GateViolation[]
}

export function hasRetryableViolations(violations: GateViolation[]): boolean {
  return violations.some((v) => v.retryable)
}

/** 拼接违规反馈，供重试时附加到 task 指令 */
export function formatViolationsForRetry(violations: GateViolation[]): string {
  const lines = violations
    .filter((v) => v.retryable)
    .map((v) => `- ${v.code}：${v.detail}`)
  return `上一次输出未通过后台校验，请修正以下问题后重新输出完整 JSON：\n${lines.join('\n')}`
}

/* ================================================================
   机制矩阵校验（mechanismSynthesizer / deepMechanismReview 产出）
   ================================================================ */

/** SP 明令禁止的中间变量机制名（必须落到家庭结构根因） */
const INTERMEDIATE_VARIABLE_PATTERN =
  /^(?:拖延|逃避|磨蹭|启动困难|内驱力不足|评价敏感|自主权不足|厌学|不自觉|叛逆)(?:机制|问题)?$/

export function gateMechanismMatrix(
  matrix: CandidateMechanism[],
  validTheoryCardIds: ReadonlySet<string>
): GateResult<CandidateMechanism[]> {
  const violations: GateViolation[] = []
  const fixed: CandidateMechanism[] = []
  const matrixNames = new Set(matrix.map((m) => (m.mechanismName || '').trim()).filter(Boolean))

  for (const m of matrix) {
    const name = (m.mechanismName || '').trim()
    if (!name) continue
    const evidence = (m.supportingEvidence || []).filter(Boolean)
    const next = { ...m }

    // 零证据机制直接丢弃（SP：没有事实锚点就不要写这条）
    if (evidence.length === 0 && !(m.evidenceRefs && m.evidenceRefs.length > 0)) {
      violations.push({ code: 'NO_EVIDENCE_DROPPED', detail: `「${name}」无任何支撑证据，已丢弃`, retryable: false })
      continue
    }

    // 中间变量收尾 → 结构性问题，打回重试
    if (INTERMEDIATE_VARIABLE_PATTERN.test(name)) {
      violations.push({
        code: 'INTERMEDIATE_VARIABLE',
        detail: `「${name}」是中间变量，必须写成「理论名：本家庭具体结构描述」并落到家庭结构根因`,
        retryable: true,
      })
    }

    // theoryCardId 不在卡库 → 清除引用（防伪造卡 ID 污染下游）
    if (next.theoryCardId && !validTheoryCardIds.has(next.theoryCardId)) {
      violations.push({ code: 'UNKNOWN_THEORY_CARD', detail: `「${name}」引用了不存在的卡 ${next.theoryCardId}，已清除`, retryable: false })
      next.theoryCardId = undefined
    }

    // v4.1：关系边指向不存在的机制 → 剔除该边（防悬空引用污染机制图）
    if (next.relatedMechanismIds?.length) {
      const validEdges = next.relatedMechanismIds.filter((e) => matrixNames.has(e.toMechanismId))
      if (validEdges.length < next.relatedMechanismIds.length) {
        violations.push({
          code: 'DANGLING_MECHANISM_EDGE',
          detail: `「${name}」有 ${next.relatedMechanismIds.length - validEdges.length} 条关系边指向不存在的机制，已剔除`,
          retryable: false,
        })
      }
      next.relatedMechanismIds = validEdges.length > 0 ? validEdges : undefined
    }

    // 空壳检测：description 太短说明只有类型标签没有因果链
    if ((next.description || '').trim().length < 40 && next.overallStrength !== 'low') {
      violations.push({ code: 'HOLLOW_MECHANISM', detail: `「${name}」描述过短（空壳），强度降为 low`, retryable: false })
      next.overallStrength = 'low'
    }

    // 三源规则：<3 条证据不得标 high（confidence 硬公式在机制粒度的执行）
    if (next.overallStrength === 'high' && evidence.length < 3) {
      violations.push({ code: 'OVERCONFIDENT_STRENGTH', detail: `「${name}」仅 ${evidence.length} 条证据标 high，降为 medium`, retryable: false })
      next.overallStrength = 'medium'
    }

    // 双源底线：<2 条证据强度封顶 low，且不得晋升诊断
    if (evidence.length < 2) {
      if (next.overallStrength !== 'low') {
        violations.push({ code: 'EVIDENCE_INSUFFICIENT', detail: `「${name}」证据不足 2 条，强度封顶 low`, retryable: false })
        next.overallStrength = 'low'
      }
      next.shouldPromoteToDiagnosis = false
    }

    fixed.push(next)
  }

  return { fixed, violations }
}

/* ================================================================
   Dossier 校验（portraitSynthesizer 产出）
   ================================================================ */

/** 理论隐身禁令：家长可见字段不得出现理论名/术语（对齐 portraitSynthesizer SP 禁令清单） */
const THEORY_LEAK_PATTERN =
  /Bowlby|Ainsworth|Baumrind|Bowen|Vygotsky|Erikson|SDT|coercive|homeostasis|强制循环|三角化|依恋型|回避型依恋|焦虑型依恋|权威型|专制型|放任型|脚手架|最近发展区|家庭稳态/

/** 跨场景标记：evidenceSummary 含这些才允许高置信（如「3/4 场景」「跨场景」「多次」） */
const MULTI_SCENE_PATTERN = /\d\s*\/\s*\d|跨场景|多场景|[2-9两三四五]\s*个?场景|多次|反复/

function clampFactors(
  factors: DossierFactor[] | undefined,
  fieldName: string,
  violations: GateViolation[]
): DossierFactor[] | undefined {
  if (!factors) return factors
  return factors.map((f) => {
    if (typeof f.confidence === 'number' && f.confidence > 0.85 && !MULTI_SCENE_PATTERN.test(f.evidenceSummary || '')) {
      violations.push({
        code: 'OVERCONFIDENT_FACTOR',
        detail: `${fieldName}「${f.label}」置信 ${f.confidence} 但 evidenceSummary 无跨场景标记，钳制到 0.7`,
        retryable: false,
      })
      return { ...f, confidence: 0.7 }
    }
    return f
  })
}

export function gateDossier(dossier: FamilyUnderstandingDossier): GateResult<FamilyUnderstandingDossier> {
  const violations: GateViolation[] = []

  // 理论隐身检测（家长可见字段；ecologicalCalibration 是内部段不检）
  const visibleTexts: Array<[string, string]> = [
    ['workingHypothesis', dossier.workingHypothesis?.text || ''],
    ['integratedSynthesis', dossier.integratedSynthesis || ''],
    ...dossier.sceneReadings.map((s, i) => [`sceneReadings[${i}]`, s.reading] as [string, string]),
    ...dossier.familyStruct.map((f, i) => [`familyStruct[${i}]`, f.label] as [string, string]),
    ...(dossier.alternativeReadings || []).map((a, i) => [`alternativeReadings[${i}]`, a.hypothesis] as [string, string]),
    ...dossier.interventionTargets.map((t, i) => [`interventionTargets[${i}]`, t.action] as [string, string]),
  ]
  for (const [field, text] of visibleTexts) {
    const m = text.match(THEORY_LEAK_PATTERN)
    if (m) {
      violations.push({
        code: 'THEORY_LEAK',
        detail: `${field} 出现理论名「${m[0]}」，家长可见字段必须理论隐身、翻译成人话`,
        retryable: true,
      })
    }
  }

  // 交织纪律：至少 2 个场景解读，否则退化为单公式
  if ((dossier.sceneReadings || []).length < 2) {
    violations.push({
      code: 'SCENE_INTERWEAVE_MISSING',
      detail: 'sceneReadings 少于 2 条：同一行为在不同场景的 protective 配比差异是交织纪律的核心，必须补齐',
      retryable: true,
    })
  }

  // 防塌缩：必须保留竞争假设
  if ((dossier.alternativeReadings || []).length < 1 && dossier.workingHypothesis?.text) {
    violations.push({
      code: 'NO_ALTERNATIVE_READING',
      detail: 'alternativeReadings 为空：假设池必须保留竞争解释，禁止单一结论塌缩',
      retryable: true,
    })
  }

  // 可证伪性：workingHypothesis 必须带 predictions
  if (dossier.workingHypothesis?.text && !(dossier.workingHypothesis.predictions || []).length) {
    violations.push({
      code: 'PREDICTIONS_MISSING',
      detail: 'workingHypothesis 无 predictions：假设必须可证伪（写出「若…则应看到…」的测试锚）',
      retryable: true,
    })
  }

  // 置信钳制（自动修复，不打回）
  const fixed: FamilyUnderstandingDossier = {
    ...dossier,
    familyStruct: clampFactors(dossier.familyStruct, 'familyStruct', violations) || [],
    fivePs: {
      ...dossier.fivePs,
      predisposing: clampFactors(dossier.fivePs.predisposing, 'predisposing', violations),
      precipitating: clampFactors(dossier.fivePs.precipitating, 'precipitating', violations),
      perpetuating: clampFactors(dossier.fivePs.perpetuating, 'perpetuating', violations),
      protective: clampFactors(dossier.fivePs.protective, 'protective', violations),
    },
  }

  return { fixed, violations }
}
