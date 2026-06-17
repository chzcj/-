/* ================================================================
   专项功能 UI 切换类型（交付文档 5.3）
   三个并列专项功能共用：沟通预演 / 教育模式诊断 / 家庭综合规划。
   核心：按当前信息缺口大小动态在「专项采集 UI」与「轻追问 UI」间切换，
   而非按功能固定 UI。
   ================================================================ */

// 三个并列专项功能
export type SpecialFeatureType =
  | 'communication_rehearsal' // 沟通预演
  | 'education_diagnosis'      // 教育模式诊断
  | 'family_planner'          // 家庭综合规划

// 本轮需要的信息量等级，决定 UI（文档 5.3.4）
export type ContextNeedLevel =
  | 'none'    // 不需要补充，直接回复或生成
  | 'light'   // 只需轻追问一个点
  | 'special' // 需要专项采集一段完整场景

// 专项上下文充分度（文档 5.3.12）
export type ContextReadiness =
  | 'empty'   // 刚开始，几乎没有可用信息
  | 'partial' // 可生成有边界的初步结果，也可继续补充
  | 'ready'   // 信息足够，可生成正式结果

// 三种实际渲染的 UI 模式
export type FeatureUiMode =
  | 'special_collection' // 专项采集 UI（重，建上下文）
  | 'light_followup'     // 轻追问 / 日常回复 UI（轻，推判断）
  | 'result_view'        // 正式结果展示

// 完整交互状态机（文档 5.3.3），含两个中间态
export type FeatureInteractionUIState =
  | FeatureUiMode
  | 'generating_result'   // 正在生成正式结果
  | 'recollection_needed' // 旧上下文不适用，需要重新专项采集

// 家长意图（文档 5.3.5）
export type FeatureUserIntent =
  | 'new_major_request'        // 提出新的大主题
  | 'continue_current_result'  // 围绕已有结果继续
  | 'ask_detail'               // 问细节
  | 'provide_feedback'         // 反馈执行效果
  | 'change_topic'             // 换主题
  | 'unclear'

// 当前问题相对上一次结果的跨度（文档 5.3.5）
export type FeatureQuestionSpan =
  | 'same_topic'
  | 'nearby_topic'
  | 'new_topic'
  | 'large_scope_shift'

/* 专项功能独立上下文包（文档 5.3.12）。
   本项目轻量实现：不落新表，由 LLM 单次判定 readiness/missingHighImpactFacts，
   已采集事实经 Episode/FactAtom 层累积，下一轮检索自然带出。
   readiness/coverage 属后台字段，禁止直接展示给前台（文档红线 5）。 */
export interface SpecialFeatureContextPack {
  featureType: SpecialFeatureType
  familyId: string
  childId: string
  source: 'special_collection' | 'light_followup' | 'material_input' | 'memory_retrieval'
  currentTopic: string
  coreFacts: string[]
  highValueFacts: string[]
  missingHighImpactFacts: string[]
  readiness: ContextReadiness
  canGenerateInitialResult: boolean
  canGenerateFullResult: boolean
  nextUiMode: FeatureUiMode
}

// FeatureUIRouter 输入（文档 5.3.5）
export interface FeatureUIRouterInput {
  featureType: SpecialFeatureType
  hasExistingContextPack: boolean
  contextReadiness: ContextReadiness
  userIntent?: FeatureUserIntent
  missingHighImpactFacts?: string[]
  currentQuestionSpan?: FeatureQuestionSpan
  lastUiMode?: FeatureUiMode
}

// FeatureUIRouter 输出（文档 5.3.5）
export interface FeatureUIRouterOutput {
  uiMode: FeatureUiMode
  contextNeedLevel: ContextNeedLevel
  reason: string
  collectionPrompt?: string
  lightFollowupPrompt?: string
  shouldReuseExistingContextPack: boolean
  shouldCreateNewContextPack: boolean
}
