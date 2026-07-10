# 育见 AI 家庭教育理解系统 · 产品技术与用户使用逻辑说明

> **文档性质**：技术白皮书 + 产品架构说明（非营销稿）  
> **版本**：V1.0 · 2026-07-09  
> **依据**：当前仓库代码、契约文档与线上实现；未单独存在的 PRD 以 `PRODUCT.md` 替代  
> **体验入口**：https://yujian.yihe.site  

---

## 阅读说明

### 本文档目标读者

投资机构技术尽调、产品架构评审、合作方技术对接人员，以及后续撰写商业计划书的 GPT/人工作者。

### 本文档要回答的六个问题

1. 育见解决什么问题  
2. 用户如何使用育见  
3. 育见如何理解一个孩子  
4. AI 如何从一次聊天升级为长期家庭理解系统  
5. 技术上为什么区别于普通 ChatGPT 式问答  
6. 当前已实现能力与未来规划的技术边界  

### 关键文件阅读清单（撰写本文时已扫描）

| 类别 | 路径 |
|------|------|
| 产品边界 | `PRODUCT.md`、`docs/product/deep-modeling.md` |
| 设计 | `DESIGN.md`、`src/data/entryConfig.ts` |
| 用户流程 | `app/daily/page.tsx`、`app/profile/build/*`、`src/lib/profile/buildEntries.ts` |
| BFF/流式 | `src/lib/server/daily/daily-turn-bff.ts`、`docs/contracts/daily-stream-events.md` |
| 编排 | `src/lib/server/orchestration/pipeline.ts` |
| 记忆/检索 | `src/lib/server/memory/retrieval/router.ts`、`docs/contracts/memory-read.md`、`docs/contracts/read-contract.md` |
| Episode/Atom | `src/lib/server/memory/episode/pipeline.ts`、`src/lib/server/db.ts` |
| 画像管线 | `app/api/synthesis/route.ts`、`prompts/front/build/profileBuildSynthesis.md` |
| Prompt 体系 | `prompts/`（43 个 prompt，`scripts/build-prompts.mjs` 生成 registry） |
| 小程序 | `miniprogram/README.md`、`docs/miniprogram-release.md` |
| 对外说明 | `docs/outreach/01-项目技术说明.md` |
| 数据库 | `src/lib/server/db.ts`（`memory_layer_items`、`evidence_episodes`、`fact_atoms` 等） |

### 资料缺失说明（本文未自行补全）

- 仓库内**无独立 PRD 文件**；产品需求以 `PRODUCT.md` 与契约文档为准  
- **无商业化财务数据、DAU/留存** 的权威记录（仅 readiness 内测规模可查）  
- **团队履历、融资计划** 不在代码库内  
- 部分旧文档仍写「五入口」；**当前 hi-fi 主站 Onboarding 为四模块**（见第二节），后端记忆层仍保留五入口命名兼容  

---

## 一、项目整体定位

### 1. 产品名称

**育见**（代码库名 ChildOS / 心镜，三者指同一产品）

### 2. 核心理念

#### 2.1 传统 AI 与育见的底层区别

**传统 AI（单次问答范式）**

```
用户提问 → 模型基于通用知识 + 当前上下文生成回答 → 会话结束或上下文重置
```

特征：无持久家庭模型、无跨轮机制验证、家长评价易被当作事实、建议泛化。

**育见（长期家庭理解范式）**

```
家庭信息采集（四模块 Onboarding + 日常片段）
    → 结构化拆解（entry_evidence / episode / daily_decompose）
    → 证据网络与机制矩阵（synthesis / diagnosis / deep_mechanism_review）
    → 家长向摘要 SecondMe（deep_model_digest）
    → 分层记忆持久化（PostgreSQL + memory_layer_items + 向量表）
    → 每轮交流：编排路由 → 检索打包 → 锚定事实的前台生成
    → 选择性回写记忆 → 动态更新理解
```

特征：**先建模、再对话**；前台输出必须引用已存储事实；低置信时追问而非硬答。

#### 2.2 对外技术表述（与实现映射）

团队对外可表述为：通过类咨询方式获取家庭场景上下文，经语义解析与检索精排，将非结构化输入转化为可推理的**原子事实网络（FactAtom + EvidenceEpisode）**，构建**家庭认知模型**（代码中分散在 `evidence_networks`、`family_interaction_cycles`、`built_profile_snapshots`、`deep_model_digest` 等层，**无名为 `FamilyModel` 的单一数据库表**），形成孩子专属 **SecondMe**（家长向深度建模摘要 + 画像快照），实现从「回答问题」到「长期理解、辅助决策」的转变。

> **术语诚实说明**：`FamilyModel`、`SecondMe` 是产品概念名；工程实现为多层 JSON 记忆项 + 摘要对象，而非独立训练的端到端神经网络模型。

### 3. 目标用户

#### 3.1 用户画像

- **主用户**：焦虑但有反思能力的家长（通常为父母）  
- **双重角色**：日常管教者 + 想理解孩子的观察者  
- **典型心理**：「我已经很努力了，但我想真的理解孩子，不是再听一套大道理。」

#### 3.2 核心痛点

| 痛点 | 说明 |
|------|------|
| 理解缺失 | 看见拖延、对抗、沉默，不知道背后家庭机制 |
| 记忆断裂 | 通用 AI 不持久记住本家庭结构与历史片段 |
| 事实与情绪混杂 | 家长焦虑、贴标签（懒、不自觉）被当成孩子事实 |
| 行动难验证 | 听懂建议，今晚仍不知如何开口 |
| 越聊越泛 | 碎片多、综合判断少 |

#### 3.3 为什么传统教育咨询难以规模化满足

- 咨询依赖人工、频次低、难沉淀结构化记忆  
- 单次会谈难以覆盖日常节奏、作业、沟通、家庭分工全貌  
- 费用与可及性限制  

#### 3.4 为什么 AI 适合进入该场景（在当前实现前提下）

- **自然语言 + 语音**降低家长叙述门槛（`HiFiInputZone`、腾讯云 ASR）  
- **多 Agent 分工**可在后台完成拆解、综合、复核，前台保持面谈语气  
- **向量检索 + 分层记忆**支持跨时间片段召回  
- **规则编排 + LLM** 组合，降低单次幻觉风险  

> **边界**：育见不做心理诊断、不给家长打分、不替代医疗/心理咨询。

---

## 二、用户完整使用流程

### 流程总览（文字图）

```
注册/登录
  → Onboarding：intro → basic → 四模块采集（每模块：输入→追问→总结）
  → final-follow-up → generating（synthesis + diagnosis API）
  → result → onboarding_complete
  → 四 Tab 主站：交流 | 任务 | 预演 | 画像
  → 长期：交流沉淀 → 任务验证 → 预演沟通 → 画像回顾 → 记忆更新飞轮
```

---

### 1. 首次进入

#### 1.1 用户看到什么

- **登录/注册**（`/login`）：手机号 + 密码；小程序为 `wx.login` + `/api/auth/wechat`  
- **Onboarding intro**（`/profile/build/intro`）：说明产品价值、柔和 hi-fi 视觉（黄绿暖调，非测评界面）  
- **basic**（`/profile/build/basic`）：孩子基础信息（昵称、年级等，用于后续语境）

#### 1.2 如何建立信任

- 设计原则（`DESIGN.md`）：不评判、不压迫、无评分暗示  
- 文案气质：「清北学长/师姐面谈」，非 ChatGPT 式万能助手  
- 分步采集，非一次性长问卷  
- 阶段总结让家长确认「系统理解是否接近」，而非直接下结论  

#### 1.3 为什么需要采集孩子/家庭信息

- 日常交流时，前台 AI **必须引用已存储事实**（`read-contract.md` 门控）  
- 无 Onboarding 数据时，系统只能低置信追问或泛化回应，无法体现「懂我家孩子」  
- 四模块覆盖：日常节奏、作业过程、沟通原话、家庭分工——后续机制推理的输入基础  

#### 1.4 如何降低输入成本

- **语音优先**：按住说话（Web `HiFiInputZone`；小程序 `useTencentAsrInput`）  
- **引导 chips**：如「上学日」「谁提醒」「孩子原话」  
- **面谈式追问**：`entryFollowUp` Agent 续问，非表格填空  
- **软质量门槛**：`isEntryCaptureUsable()` 约 45 字 + 场景词，或 ≥70 字（非硬阻断）  

---

### 2. 四模块家庭信息采集（当前 hi-fi 实现）

> **重要**：`src/data/entryConfig.ts` 与 `BUILD_ENTRY_ORDER` 定义为 **4 模块**。  
> 旧文档/后端 `EntryName` 仍有五入口枚举（如 `emotional_stress`），为历史兼容；**家长 UI 为四模块**。

| 序号 | 模块 type | 家长侧标题 | 采集目的 |
|------|-----------|------------|----------|
| 1/4 | `daily` | 孩子平时怎么过 | 日常节奏、作息、手机、睡眠、周末安排 |
| 2/4 | `homework` | 学习和作业怎么进行 | 作业从准备到收场全过程、催促与检查 |
| 3/4 | `communication` | 你们通常怎么沟通 | 典型对话原话、升级与冷场方式（含情绪压力维度） |
| 4/4 | `family` | 家里怎么一起支持他 | 家长分工、规则落地、老人参与、试过办法 |

#### 2.1 单模块用户路径

```
/profile/build/{module}           输入（语音/文字）
  → /profile/build/{module}/follow-up   AI 追问（entryFollowUp Agent）
  → /profile/build/{module}/summary     阶段总结确认
  → 下一模块或 final-follow-up
```

#### 2.2 每模块：用户需提供什么 / 系统希望获取什么

以 **homework（学习作业）** 为例：

| 维度 | 内容 |
|------|------|
| 用户输入 | 真实过程叙述：谁提醒、孩子反应、拖到几点、如何收场 |
| 系统希望 | 可验证事实、孩子行为、触发点、家长动作；**非**「懒/不自觉」等评价词当孩子事实 |
| 质量判断 | 场景词命中、`isEntryCaptureUsable`；过薄则追问 Agent 补缺口 |
| 结构化输出 | `entry_evidence` Agent → `entry_evidence_packs` 层（JSON） |

#### 2.3 四模块完成后的综合生成

```
POST /api/synthesis  → profileBuildSynthesis Agent
POST /api/diagnosis  → profileBuildDiagnosis Agent（generating 页调用）
  → memory_write job 入队
  → built_profile_snapshots、evidence_networks、conditional_profiles、family_interaction_cycles 等写入
  → users.onboarding_complete = true
```

---

### 3. AI 后台处理过程（用户输入 → 画像更新）

以下为用户一次输入在系统中的**真实处理链**（按场景分路径）。

#### 3.1 Onboarding 模块提交路径

```
家长语音/文字
  ↓
[若语音] 客户端 ASR → 文本（腾讯云 WebSocket；需 /api/asr/token）
  ↓
前台采集页保存 rawText + stageSummary（localStorage 草稿 + 后端 build-state API 同步）
  ↓
模块完成 → entry_evidence Agent（prompts/background/entryEvidenceBuilder.md）
  ↓
输出 decomposedInput：
  - verifiableFacts / childBehaviors / triggerPoints
  - parentActions / parentEvaluations / parentGoals / missingInformation
  + candidateMechanisms（候选机制，默认需跨入口验证）
  ↓
写入 memory_layer_items.layer_name = 'entry_evidence_packs'
```

#### 3.2 日常交流路径（/api/daily/stream）

```
家长输入 userText
  ↓
并行：
  A) ensureDigestPack：load deep_model_digest；若无则 buildDeepModelDigest（确定性拼装，可能触发 LLM digest build）
  B) runOrchestrationPipeline（无 LLM）：
       - 安全分级 classifySafetyTier
       - 检索 buildDailyDialogueRetrievalPacket（向量 Episode 或降级取最近）
       - 输入分类 classifyInputType
       - 与已有模型关系 determineRelationship
       - 路由 buildRoutingDecision（是否追问、响应类型）
       - memoryAction 规划
  ↓
streamProseAndSections（单次 LLM 流式）：
  - system: parentFacingStyle + deepModelingParentDigest + dailyDialogueOrchestration + parentFacingCopy
  - user payload: retrievalPack + deepModelDigest + userText + 路由字段
  - 输出 prose → section markers → sections → taskTitle
  ↓
SSE 事件流（见 daily-stream-events 契约）
  ↓
异步（不阻塞前台）：
  - 选择性 memory_write / episode_ingest job
  - turn_events 快照
```

#### 3.3 日常输入的后台深拆（异步，非每轮阻塞家长）

满足条件时 `enqueueJob('episode_ingest')` 或 memory 管线触发：

```
家长文本
  ↓
episodeExtractor Agent → EvidenceEpisode（语义完整摘要）+ FactAtom 列表
  ↓
embedText（阿里百炼 text-embedding-v3，1024 维，需 EMBEDDING_API_KEY）
  ↓
写入 evidence_episodes + fact_atoms（pgvector，可降级）
```

另：`dailyDecompose` Agent 可做六维深拆 + 0-2 条 newHypotheses（绝大多数轮为空）。

#### 3.4 深度机制复核（周期性/触发式）

```
deep_mechanism_review 多 Agent 链（ecosystemClassifier、theoryMatcher、mechanismSynthesizer、structuralRiskExtractor）
  ↓
读全量记忆层
  ↓
覆盖/更新 evidence_networks.candidateMechanismMatrix
  ↓
更新 parent_narrative_patterns、pending_hypotheses
  ↓
deepModelDigestBuilder（可 LLM）→ deep_model_digest
```

#### 3.5 各步输入/处理/输出对照表

| 步骤 | 输入 | 处理 | 输出 |
|------|------|------|------|
| ASR | 音频流 | 腾讯云实时识别 | 文本 |
| entry_evidence | rawText | LLM 结构化拆解 | entry_evidence_packs |
| synthesis | 四模块 packs | LLM 证据网络综合 | candidateMechanismMatrix 草案 |
| diagnosis | synthesis 交接 | LLM 诊断/条件画像 | coreJudgment、cycles 草案 |
| episodeExtractor | 日常文本 | LLM + embedding | episodes + atoms |
| retrieval router | query + 租户 | DB 读 + 向量检索 + 精排 | DailyDialogueRetrievalPacket |
| orchestration | userText + packet | 规则引擎 | OrchestrationOutput |
| 前台 LLM | digest + retrievalPack | 流式生成 | prose + sections |
| digest-builder | 各记忆层 | 确定性拼装（可叠加 LLM） | DeepModelDigest |

> **关于「权重计算」**：代码中存在 `hypothesis.weight`、`mechanism.overallStrength`、`rankByRelevance` 相似度排序、`promoteMaturity` 成熟度提升规则；**并非独立命名的「权重系数引擎」产品模块**，而是分布在检索精排与假设/机制强度字段中。

---

### 4. 孩子画像生成逻辑

#### 4.1 不是简单标签

**普通 AI 画像（育见明确避免）**

- 「孩子内向」「学习不好」等静态标签  
- 无证据链、无家庭上下文  

**育见画像（实现形态）**

多层结构，动态更新：

| 层/对象 | 内容 | 存储位置 |
|---------|------|----------|
| 条件画像 | childTendency 等人话描述 | conditional_profiles |
| 核心判断 | coreJudgment | built_profile_snapshots |
| 深度机制叙述 | deepMechanism | built_profile_snapshots |
| 机制候选矩阵 | mechanismName、supportingEvidence、overallStrength | evidence_networks |
| 家庭互动循环 | 家长触发→孩子反应→二次解读 | family_interaction_cycles |
| 待验证假设 | pending_hypotheses | memory_layer_items |
| 家长叙事模式 | observations、interactionImplications | parent_narrative_patterns |
| SecondMe 摘要 | mechanismNarrative、anchoredFacts、interactionLoops | deep_model_digest |
| 前台画像卡 | portraitCards、thinkingChips | dailyPortraitRefresh 产出 |

#### 4.2 画像维度（按实际字段归纳）

| 维度 | 数据来源 | 家长可见形态 |
|------|----------|--------------|
| 基础信息 | basic 页、account state | 孩子昵称、年级 |
| 日常节奏 | daily 模块 | 作息/手机/疲劳线索 |
| 学习作业 | homework 模块 | 作业流程卡点 |
| 亲子沟通 | communication 模块 | 原话、升级模式 |
| 家庭支持 | family 模块 | 分工、规则、大人一致性 |
| 行为模式 | entryFacts + episodes | 交流/画像中场景引用 |
| 机制理解 | matchedMechanisms | 人话机制描述（非理论卡名） |
| 情绪与压力 | 融入沟通/日常叙述 | 不单独贴诊断标签 |
| 互动循环 | familyPatterns | 「你一催他就…」类循环描述 |
| 待验证点 | pendingHypotheses | 条件化「可能更像…」 |

#### 4.3 动态更新机制

```
新信息进入（交流 / 任务反馈 / 反证）
  ↓
episode_ingest / daily_update / memory_write（选择性，非每轮全写）
  ↓
model_review / deep_mechanism_review（周期或触发）
  ↓
更新 evidence_networks / hypotheses / digest
  ↓
下轮交流 retrievalPack 变化 → 前台输出变化
```

**不是一次生成永久不变**；`counter_evidence` 关系类型会主动修正既有判断（`pipeline.ts`）。

---

## 三、核心技术架构

### 1. 总体技术架构（文字版）

```
┌─────────────────────────────────────────────────────────────┐
│ 用户层                                                       │
│  Web（Next.js hi-fi 四 Tab）· 微信小程序（Taro 3，对齐中）      │
│  语音输入 · 流式阅读 · Onboarding 分包                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / NDJSON SSE
┌───────────────────────────▼─────────────────────────────────┐
│ 交互层（BFF）                                                │
│  /api/daily/stream · daily-turn-bff · prose-section-stream   │
│  thinking 推送 · section 流 · actions 合成                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ AI 理解层（编排 + Agent）                                    │
│  orchestration pipeline（规则）                              │
│  40+ prompts：前台 parentFacing / 后台 evidence·episode·review │
│  DeepSeek v4-flash（主）· 可选 PARENT_AI 豆包端点             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ 知识/记忆层                                                  │
│  PostgreSQL memory_layer_items（分层 JSON）                    │
│  evidence_episodes + fact_atoms + pgvector                   │
│  turn_events · job_queue 异步任务                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ 推理生成层                                                   │
│  检索打包 → 前台 LLM（锚定事实门控）                          │
│  后台 LLM（synthesis/diagnosis/deep review/digest）          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ 反馈更新层                                                   │
│  memory_write · episode_ingest · 任务反馈 · model_review     │
└─────────────────────────────────────────────────────────────┘
```

### 2. 各层作用简述

| 层级 | 作用 |
|------|------|
| 用户层 | 采集叙述、展示流式理解、预演与画像浏览 |
| 交互层 | 聚合编排结果、控制 SSE 事件顺序、隐藏 section 预取 |
| AI 理解层 | 拆解、综合、复核、生成；前后台 Agent 分离 |
| 知识/记忆层 | 持久化事实、机制、假设；向量召回 |
| 推理生成层 | 结合检索与 digest 生成家长可见文本 |
| 反馈更新层 | 异步回写，避免阻塞首字 |

---

## 四、FamilyModel 技术体系

> 本节使用产品概念 **FamilyModel**；工程上为多层记忆与摘要的集合，见 4.2。

### 1. 什么是 FamilyModel（在本项目中）

**FamilyModel** 指：持续积累家庭事实、理解家庭互动关系、记录孩子成长变化、支撑未来建议的**家庭认知模型**。

它不是单一用户画像 JSON，而是包括：

- 入口证据包（四模块）  
- 证据网络与机制矩阵  
- 家庭互动循环（L7 cycles）  
- 家长叙事模式  
- 待验证假设  
- 日常 Episode/Atom 向量库  
- 家长向 deep_model_digest（SecondMe 摘要）  

### 2. 为什么家庭教育需要 FamilyModel

家庭教育问题高度**情境依赖**：同一「拖延」在不同家庭的触发、家长动作、孩子防御功能不同。无家庭模型时，AI 只能输出人口统计学意义上的建议。

### 3. 数据来源

| 来源 | 实现 |
|------|------|
| 家长主动输入 | 四模块 Onboarding、日常交流 |
| AI 追问 | entryFollowUp、交流低置信追问 section |
| 历史片段 | turn_events、episodes 检索 |
| 用户反馈 | 任务完成反馈 → memory |
| 反证 | counter_evidence 路由 → episode 高价值 atom |

### 4. 数据结构（概念 → 工程）

```
原始叙述（rawText）
  ↓
结构化事实（decomposedInput / FactAtom）
  ↓
证据网络（candidateMechanismMatrix）
  ↓
互动循环（FamilyInteractionCycle）
  ↓
假设与叙事（pendingHypotheses / parentNarrativePattern）
  ↓
家长向摘要（DeepModelDigest / SecondMe）
  ↓
前台建议（prose + sections + actions）
```

### 5. 动态更新（再次强调）

新信息 → 检索命中变化 → 关系类型可能从 `old_mechanism_repetition` 变为 `counter_evidence` → 机制复核 job 更新网络 → digest 刷新 → 下轮输出调整。

---

## 五、核心 AI 能力拆解

### 1. 非结构化家庭信息理解

家庭信息特征：碎片化、长期性、情绪化、隐含信息多。

育见处理策略：

- **拆分维**：entry_evidence 与 dailyDecompose 区分 facts / emotions / evaluations / goals  
- **不采信评价为事实**：parentEvaluations 独立字段  
- **Episode 保持语义完整**：避免检索碎片丢失语境  
- **面谈式交互**：降低家长「写报告」负担  

### 2. 语义解析能力（已实现 Agent）

| 类型 | 示例 | 处理 |
|------|------|------|
| 事实 | 「最近三天写到 11 点」 | verifiableFacts / scene atom |
| 情绪 | 「我真的很焦虑」 | parentEmotions，不当孩子事实 |
| 评价 | 「他就是不努力」 | parentEvaluations |
| 期待 | 「希望他主动学习」 | parentGoals |
| 孩子原话 | 「知道了别说了」 | child_quote atom，高价值 |

### 3. 原子事实网络

**原子事实（FactAtom）**：最小可追溯陈述，带 `sourceType`、`factType`、`evidenceStrength`。

**EvidenceEpisode**：语义完整的场景单元，承载 summary + 多个 atoms；**向量检索主单元**。

对比：

| 普通记录 | 原子网络 |
|----------|----------|
| 「孩子学习不好」 | 数学失分位置、作业时长、催促次数、抵触原话、反证片段 |

推理支持：机制矩阵的 `supportingEvidence`、前台 `entryFacts` 直喂、假设验证。

### 4. AI 推理机制（实现边界）

育见**不是**单一端到端黑盒推理引擎，而是：

1. **规则编排**判断信息是否足够、是否安全、是否与旧模型一致  
2. **检索**召回相关 Episode/事实  
3. **后台 LLM** 在证据充分时更新机制矩阵与假设  
4. **前台 LLM** 在门控下生成人话输出（必须引用 anchoredFacts）  

从事实到建议的路径：**机制候选 → 条件化叙述 → 今晚可试任务**，而非直接诊断。

---

## 六、产品核心交互逻辑

### 1. 高置信情况（`composeHighConfidenceSkeleton`）

**条件**（简化）：非 `insufficient`、非 `one_key_followup`、confidenceMode 非 low。

**Section 骨架示例**：

- 判断依据（history_thinking）  
- 深度分析（diagnosis_headline）  
- 今晚先这样试（advice）  
- hidden：结合画像分析、孩子可能怎么想  

**设计原因**：反思型家长需要「依据 → 理解 → 小步行动」；hidden section 预取不阻塞首屏。

### 2. 低置信情况（`composeLowConfidenceSkeleton`）

**条件**：`relationshipToExistingModel.type === 'insufficient'` 等。

**输出结构**：

- 目前有几个可能方向（directions）  
- 这次更像是（this_time）  
- 追问（follow_up）——每轮最多一个主问题，先区分 A/B  

**设计原因**：信息不足时硬答会损害信任；追问是「裁决两个候选方向」而非填表。

### 3. 流式交互时序（家长感知）

```
thinking 四宫格（编排完成）
  → prose 流式短回复
  → section 紧接流出
  → actions 出现后可发下一条
```

技术：`streamProseAndSections` 单次 LLM + marker；客户端 `dailyStreamClient` smoothQueue。

---

## 七、与普通 AI 产品区别

| 维度 | 普通 AI 助手 | 育见 |
|------|--------------|------|
| 信息来源 | 当前 prompt + 短上下文 | 四模块证据 + 分层记忆 + 向量 Episode |
| 理解深度 | 通用模式匹配 | 机制链 + 互动循环 + 条件画像 |
| 记忆能力 | 会话级/有限 | PostgreSQL 多层 + digest 摘要 |
| 个性化 | 人设 prompt | 家庭级 SecondMe，引用原话与事实 |
| 决策支持 | 一次性建议 | 任务验证 + 预演 + 追问验证假设 |
| 长期陪伴 | 弱 | 设计目标为跨周/月累积更新 |
| 输出形态 | 长回答 | 短 prose + 结构化 section + actions |
| 安全 | 通用策略 | safety tier 专用响应路径 |

---

## 八、技术壁垒分析（基于真实实现）

### 1. 家庭场景数据积累壁垒

- 四模块深采集 + 日常 Episode 持续写入  
- entryFacts 直喂避免「只有摘要丢失细节」  
- 租户隔离（family_id + child_id）  

### 2. 长期记忆体系壁垒

- `memory_layer_items` 多 layer_name 分工  
- `turn_events` 快照 + `daily_updates`  
- pgvector Episode 检索（可降级）  
- job_queue 可靠异步写入  

### 3. FamilyModel 结构壁垒

- 证据网络 + 互动循环 + 假设状态机  
- deep_mechanism 多 Agent 复核链  
- 前后台读取契约（`read-contract.md`）防架构腐化  

### 4. 家庭教育 Prompt 体系壁垒

- 43 个分角色 prompt（`prompts/`）  
- parentFacingStyle 宪法级约束  
- entry/daily/decompose 等结构化 JSON 契约  

### 5. 用户交互采集机制壁垒

- 语音优先 + 面谈追问  
- Onboarding 分模块降低认知负荷  
- 反证与任务反馈闭环  

### 6. 场景理解能力壁垒

- orchestration 输入类型与关系类型枚举  
- warmTurn 检索缓存  
- maturity L0–L4 晋级影响检索与路由  

---

## 九、当前技术实现

### 1. 技术栈

| 类别 | 实现 |
|------|------|
| 前端 Web | Next.js App Router、TypeScript、hi-fi CSS（`hifi-app.css`） |
| 小程序 | Taro 3 + React（`miniprogram/`） |
| 后端 | Node.js、server-only 模块 |
| 数据库 | PostgreSQL；pgvector 扩展（可选） |
| 缓存/会话 | auth_sessions；检索 session cache（warmTurn） |
| 模型 | DeepSeek `deepseek-v4-flash`（`FAST_AI_*`）；可选 `PARENT_AI_*` |
| Embedding | 阿里百炼 `text-embedding-v3`，1024 维 |
| ASR | 腾讯云实时语音识别（`/api/asr/token` + WebSocket） |
| 部署 | PM2（`server-ws.js`）、rsync deploy.sh |
| 任务队列 | job_queue（memory_write、episode_ingest 等） |

### 2. 主要 API（已实现）

| 路径 | 用途 |
|------|------|
| `/api/daily/stream` | 日常交流主入口（NDJSON 流式） |
| `/api/synthesis` | 四模块综合建模 |
| `/api/diagnosis` | 画像诊断生成 |
| `/api/tasks` | 任务列表与反馈 |
| `/api/rehearsal/analyze` | 预演分析 |
| `/api/profile/hub` 等 | 画像数据 |
| `/api/auth/*` | 登录注册；`/api/auth/wechat` 小程序 |
| `/api/asr/token` | ASR 鉴权 |
| `/api/readiness` | 健康检查 |

### 3. Agent 与 Prompt

- 构建：`npm run prompts` → `registry.generated.ts`  
- 调用：`callAgentJson` / `callParentTextStream`（`ark-agents.ts`）  
- 前台流式：合并 prose+section 单次调用  

### 4. 流式输出

- SSE 替代：HTTP chunked NDJSON  
- 事件契约：`docs/contracts/daily-stream-events.md`  
- 观测：`[stream:timing]`、`[daily/stream] ttft=` 日志  

### 5. 数据库核心表/层（节选）

| 存储 | 用途 |
|------|------|
| users | 账号、onboarding_complete、wechat_openid |
| memory_layer_items | 分层 JSON 记忆（主存储） |
| evidence_episodes | 向量 Episode |
| fact_atoms | 原子事实 |
| conversations | 会话元数据 |
| job_queue | 异步任务 |

### 6. 线上状态（readiness 可查，非财务）

- 站点：https://yujian.yihe.site  
- 内测规模量级：用户约 21、memory_layer_items 约 3613（随环境变化）  
- 公益试点：清华 iCenter 支持；支教与丰台社区推广（见 outreach 文档）  

---

## 十、未来技术演进路线

### 已实现（截至 2026-07 代码库）

- hi-fi 四 Tab Web 主站  
- 四模块 Onboarding + synthesis/diagnosis 画像管线  
- 日常流式 BFF + 合并 prose/section  
- Episode/Atom 向量检索（pgvector 可降级）  
- deep_model_digest + 机制复核链  
- 任务、预演、画像 Tab  
- 微信小程序支线（API 复用，UI 对齐中）  
- 微信登录、build-state 跨设备续做  

### 近期（文档/代码已标注，未完全实现）

| 项 | 状态 |
|----|------|
| 小程序 Visual Parity 全页 | 进行中（`visual-diff.md`） |
| DailyDeepExpandCard 完整独立组件 | partial |
| section-retry 小程序 | P3 |
| 手机号与微信账号合并 | 二期 `bind-phone` |
| 交流轮同步 digest LLM build 优化 | 性能议题（HANDOFF） |

### 长期规划 / 设想（代码库未实现，勿写入「已上线」）

以下**未在当前代码中发现完整实现**，仅可作为方向：

- 多模态家庭理解（作业拍照 OCR 已有 `materialUnderstanding` 路由痕迹，非主流程）  
- 聊天记录自动导入分析  
- 作业过程连续分析  
- 语音情绪分析  
- 「家庭数字孪生」可视化  
- 端到端微调家庭教育专用模型（当前为通用 LLM + Prompt/记忆工程）  

---

## 十一、商业化与规模化的技术基础（客观陈述）

育见已具备的技术基础包括：

1. **可复用 BFF + API**：Web/小程序/未来 B2B 接入同一后端  
2. **租户隔离记忆模型**：家庭级数据边界清晰  
3. **异步 job 架构**：写入与推理可扩展  
4. **契约化文档**：stream/memory/read 契约利于协作与审计  
5. **Prompt 注册表**：领域知识可迭代而不改代码  

当前限制规模化因素（如实）：

- LLM 推理成本与首字延迟（prefill）  
- embedding/向量依赖外部 API  
- 内测用户规模仍小，机制矩阵质量依赖真实使用数据积累  

---

## 十二、术语表

| 术语 | 含义 |
|------|------|
| 育见 | 产品品牌 |
| FamilyModel | 家庭认知模型（产品概念；多层记忆实现） |
| SecondMe | 孩子专属深度理解档案（`deep_model_digest` + 画像快照） |
| FactAtom | 原子事实单元 |
| EvidenceEpisode | 语义完整场景记忆单元 |
| retrievalPack | 前台 AI 每轮只读上下文包 |
| OrchestrationOutput | 编排管道输出（路由、关系类型、检索上下文） |
| warmTurn | 同线程后续轮，复用检索缓存 |
| maturity L0–L4 | 上下文成熟度，影响检索与路由 |

---

## 十三、给 BP 撰写者的映射提示

| BP 模板章节 | 本文章节 |
|-------------|----------|
| 项目概述 | 一 |
| 用户需求与流程 | 二 |
| 技术架构 | 三、九 |
| 核心壁垒 | 四、五、八 |
| 竞品差异 | 七 |
| 未来规划 | 十 |
| 运营数据 | 九.6（有限）；其余【待补全】 |

---

*本文档仅描述截至 2026-07-09 仓库可见实现；若代码与文档冲突，以代码与契约为准。*
