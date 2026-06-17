import 'server-only'
import type {
  ContextNeedLevel,
  ContextReadiness,
  FeatureUiMode,
  FeatureUIRouterInput,
  FeatureUIRouterOutput,
  SpecialFeatureContextPack,
  SpecialFeatureType
} from '@/types/feature-ui'
import type { TenantId } from '@/lib/server/memory/tenant'

/* ================================================================
   FeatureUIRouter — 专项功能 UI 切换决策器（交付文档 5.3.5 / 5.3.6）
   纯规则函数（文档明确：UI 模式应由后台规则按 readiness/missingFacts 判定，
   而非 AI 决策）。三个专项功能共用。
   ================================================================ */

const NEED_LEVEL_BY_MODE: Record<FeatureUiMode, ContextNeedLevel> = {
  special_collection: 'special',
  light_followup: 'light',
  result_view: 'none'
}

/**
 * 决定本轮应展示哪种 UI。决策树（文档 5.3.6）：
 * - 首次进入 / 无上下文 / readiness=empty       → 专项采集（重）
 * - 提出新大主题 / 跨度过大                      → 专项采集（重新建上下文）
 * - readiness=ready 且只是看结果/继续             → 结果展示
 * - readiness=partial 且仍缺关键事实              → 轻追问（只问一个点）
 * - 其余默认                                      → 轻追问
 */
export function decideFeatureUI(input: FeatureUIRouterInput): FeatureUIRouterOutput {
  const {
    hasExistingContextPack,
    contextReadiness,
    userIntent = 'unclear',
    missingHighImpactFacts = [],
    currentQuestionSpan = 'same_topic'
  } = input

  const firstVisit = !hasExistingContextPack
  const newBigTopic = userIntent === 'new_major_request' || currentQuestionSpan === 'new_topic' || currentQuestionSpan === 'large_scope_shift'

  // 1) 首次进入或无上下文或信息空 → 专项采集 UI
  if (firstVisit || contextReadiness === 'empty') {
    return finalize('special_collection', {
      reason: firstVisit ? '首次进入该专项功能，需要先建立上下文' : '当前几乎没有可用信息，需要家长完整讲一段',
      shouldReuseExistingContextPack: hasExistingContextPack,
      shouldCreateNewContextPack: !hasExistingContextPack
    })
  }

  // 2) 提出新大主题 / 跨度过大 → 重新专项采集（recollection）
  if (newBigTopic) {
    return finalize('special_collection', {
      reason: '家长提出了新的大主题，旧上下文不适用，需要重新采集',
      shouldReuseExistingContextPack: false,
      shouldCreateNewContextPack: true
    })
  }

  // 3) 信息已足够且只是查看/继续围绕结果 → 结果展示
  if (contextReadiness === 'ready' && (userIntent === 'continue_current_result' || userIntent === 'ask_detail' || userIntent === 'unclear')) {
    return finalize('result_view', {
      reason: '信息已足够，展示正式结果，后续围绕结果继续',
      shouldReuseExistingContextPack: true,
      shouldCreateNewContextPack: false
    })
  }

  // 4) 部分信息但仍缺关键事实 → 轻追问一个点
  if (contextReadiness === 'partial' && missingHighImpactFacts.length > 0) {
    return finalize('light_followup', {
      reason: `已有基础信息，仅需补一个关键点（还差 ${missingHighImpactFacts.length} 类）`,
      shouldReuseExistingContextPack: true,
      shouldCreateNewContextPack: false
    })
  }

  // 5) 默认：在已有上下文上轻追问推进
  return finalize('light_followup', {
    reason: '在已有上下文上继续理解与推进',
    shouldReuseExistingContextPack: true,
    shouldCreateNewContextPack: false
  })
}

function finalize(
  uiMode: FeatureUiMode,
  rest: Omit<FeatureUIRouterOutput, 'uiMode' | 'contextNeedLevel'>
): FeatureUIRouterOutput {
  return { uiMode, contextNeedLevel: NEED_LEVEL_BY_MODE[uiMode], ...rest }
}

/* ----------------------------------------------------------------
   把 LLM 单次判定结果归一为 SpecialFeatureContextPack（轻量，不落表）。
   readiness 由 LLM 输出，missingHighImpactFacts 同理；
   canGenerate* 门槛在此统一计算，前台据此切换而不触碰 readiness 本身。
   ---------------------------------------------------------------- */
export function deriveContextPack(args: {
  featureType: SpecialFeatureType
  tenant: TenantId
  source: SpecialFeatureContextPack['source']
  currentTopic: string
  readiness: ContextReadiness
  missingHighImpactFacts: string[]
  coreFacts: string[]
  highValueFacts: string[]
}): SpecialFeatureContextPack {
  const { readiness } = args
  const canGenerateInitialResult = readiness === 'partial' || readiness === 'ready'
  const canGenerateFullResult = readiness === 'ready'
  const nextUiMode: FeatureUiMode = readiness === 'ready'
    ? 'result_view'
    : readiness === 'partial'
    ? 'light_followup'
    : 'special_collection'

  return {
    featureType: args.featureType,
    familyId: args.tenant.familyId,
    childId: args.tenant.childId,
    source: args.source,
    currentTopic: args.currentTopic,
    coreFacts: args.coreFacts,
    highValueFacts: args.highValueFacts,
    missingHighImpactFacts: args.missingHighImpactFacts,
    readiness,
    canGenerateInitialResult,
    canGenerateFullResult,
    nextUiMode
  }
}

// 把 LLM 输出的 readiness 字符串安全归一（防脏值）。
export function normalizeReadiness(value: unknown): ContextReadiness {
  return value === 'ready' || value === 'partial' || value === 'empty' ? value : 'empty'
}
