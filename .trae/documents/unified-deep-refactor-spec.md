# 育见 · 前后台 Agent + SP + 契约 + 字段统一深度改造总纲

> Trae 2026-07-23 产出。汇总近 10 轮讨论全部结论 + 三轮代码/契约/类型审计，形成可执行的总纲。
> 凌驾于前 5 份文档之上，是它们的一致化与落地排序权威。系统工程论铁律：**整体效果 = min(各环节)**，任何一环薄都让整体失效。

---

## Part 0 · 近 10 轮结论汇总（5 份文档核心提炼）

| 文档 | 核心结论 | 关键产出 |
|---|---|---|
| `dossier-v3-fullchain-audit-and-improvement-plan.md` | PORTRAIT_V3 未开 → dossier 从未生成 → 前台靠扁平碎片瞎猜 | 服务器实测铁证 + 18 断点 + 3 层改进 |
| `product-memory-architecture.md` | 双引擎（后台底稿 + 前台事实分析）+ 两铁律（机制不模板化 / 前台事实锚定） | 写入批量 + 读取双引擎 + cache 落地 + 全功能闭环 |
| `deep-portrait-v4-multihead-triangulation.md` | 5 视角头 + 三角验证 + 机制关系图 + 贝叶斯假设池 + 证据图 | dossier 从"并行矩阵"升级为"互相勾连的网络" |
| `gnn-family-reasoning-theory.md` | 深度非层数（过平滑/过挤压）+ 关系决定特征如何被理解 + SRM/APIM 不归因 + 认识论隔离 | 12 节点 14 边异构图 + φ_r 消息函数 + 五个"不能线性相加" |
| `sparse-data-harness-thick-sp-plan.md` | 数据永远稀疏 → 贝叶斯先验 + 认识论诚实；木桶效应 → post-gate harness 补最短板；persona+harness+厚SP | 效果瓶颈 4 项优先于成本优化 |

**一句话**：后台要建"带场景配比+权重+反证的可演进底稿"（不是模板 loop），前台要"事实锚定+替代解释+把握度"（不硬套死画像），全程"认识论隔离"（推断不当事实传播），稀疏数据下"诚实标注 > 硬猜"。

---

## Part 1 · 全链路最短板地图（系统工程论视角）

全链路 6 环，每环都有薄点。**最短板决定整体效果**：

```
理论层 ──→ SP 层 ──→ 类型层 ──→ DB 层 ──→ 契约层 ──→ 前台消费
（厚）     （中）     （薄！）   （薄！）   （薄！）   （中）
```

### 1.1 各环薄点清单（审计实证）

| 环 | 薄点 | 实证 | 危害 |
|---|---|---|---|
| **理论层** | 已较厚（5 份文档） | — | 不是瓶颈 |
| **SP 层** | 缺 post-gate 校验；缺认识论隔离段；缺稀疏数据诚实段；缺反套模板；前后台术语不完全对齐 | parentFacingStyle 241 行 ~60% 硬规则但无产出后校验；portraitSynthesizer 221 行 ~80% 但无认识论隔离 | LLM 偷懒无人管，套模板废产出 |
| **类型层** | atom 缺 5 认识论字段；EvidenceRef 无正式类型；TriangulatedFact/FamilyAgentPersona 无类型；机制缺 sceneReadings/边；假设缺贝叶斯三件套 | db.ts AtomRow 无 epistemic_status；database.ts supportingEvidence 全 string[] | 判断不绑证据 id，无法回溯 |
| **DB 层** | evidenceTier/factRole 抽取时有写库时丢；fact_atoms 缺 5 列 | pipeline.ts L113-128 构造 AtomRow 未映射 evidenceTier/ecologicalLayer/factRole | LLM 产出被扔，推理素材缺 |
| **契约层** | memory-write 过时（PR-B3）；read-contract 8 处厚包上限过时；dossier 无契约；atom 无契约；11 个 job 无契约 | memory-write.md 仍写 memory_write→deep_mechanism；read-contract 厚包上限落后代码一倍 | 误导开发，改链路时依据错误 |
| **前台消费** | hidden 丢 pack；how-to-speak 漏 dossierSlice；rehearsal 硬编码；dossierSlice 键序破坏 cache | parent-facing-copy L106-117；how-to-speak route L103-137 | 前台拿不到厚事实 |

### 1.2 最短板排序（效果瓶颈优先于成本）

| 排名 | 最短板 | 修复 | 难度 |
|---|---|---|---|
| **1** | DB 层 evidenceTier/factRole 写库时丢 | pipeline.ts 补映射 + db.ts 补列 | 极低（字段已有，只差映射） |
| **2** | 类型层 atom 缺 epistemic_status | db.ts 加列 + AtomRow 加字段 + pipeline 映射 | 低 |
| **3** | 类型层 EvidenceRef 无正式类型 + supportingEvidence 全 string[] | database.ts 新增类型 + 升级消费方 | 中 |
| **4** | SP 层 缺 post-gate harness 校验 | 新建 harness 校验函数 | 中 |
| **5** | 契约层 memory-write 过时 + 厚包上限过时 | 更新契约文档 | 低 |
| **6** | 前台 hidden 丢 pack + how-to-speak 漏 dossierSlice | 改 payload | 低 |
| 7 | cache 没接线 / episode 每轮深拆 | session cache + 批量 | 中（成本优化，后做） |

**铁律**：先补 1-6（效果瓶颈），7 后做。不补 1-6，理论再厚前台还是套模板废产出。

---

## Part 2 · 改造总原则（贯穿全链路的 5 条）

### 原则 1 · 双引擎，非大后台小前台
- 后台 = 慢更新"家庭理论底稿"（dossier + 场景化机制）
- 前台 = 快响应"事实 + 底稿综合分析师"（domainAtomFacts + dossierSlice）
- 100 条作业 atom + 1 段 dossier 底稿 → 前台综合判断，不是 3 条抽象机制复读

### 原则 2 · 认识论隔离（防推断自我强化）
```
observed → reported → derived → inferred → hypothesized
（可信度递减，传播权限递减）
hypothesized 不得升级为 observed，只能：
- 被 ≥2 独立来源印证 → 升级为 derived
- 被反证 → 降级为 dismissed
- 持续无新证据 → 维持 hypothesized
```
**全链路落地**：atom 带 epistemic_status；SP 禁止把 inferred 当 observed；post-gate 校验传播权限。

### 原则 3 · 事实锚定 + 替代解释 + 把握度（前台三件套）
- 回答前引用 ≥2 条本家庭 atom（原话或可追溯事实）
- 列 ≥1 个替代解释（竞争假设）
- 标把握度（3 条证据低置信 / 10 条中 / 50 条高）
- 缺则写"这块我还需要更多场景"而非套机制

### 原则 4 · 非归因（SRM/APIM）
- 禁用"你是…型家长""孩子这样是因为你…""根本原因就是…"
- 改用"在这些情境中更容易出现…""目前可能存在这样一个循环…""现有证据还不足以排除…"
- 输出 = 多机制混合（Σ π_k·M_k），不是单一结论

### 原则 5 · 稀疏数据诚实 > 推理能力
- 数据不够时降 confidence 而非硬猜
- 3 条证据 → 1 个低置信假设 + 待验证方向 + 标注"信息不足"
- 贝叶斯先验来自 THEORY_CARDS，少量证据做似然更新

---

## Part 3 · 字段层改造（类型 + DB）

### 3.1 atom 字段补全（最短板 1+2，优先级最高）

**db.ts fact_atoms 建表加 5 列**：
```sql
ALTER TABLE fact_atoms
  ADD COLUMN epistemic_status TEXT NOT NULL DEFAULT 'reported',
  ADD COLUMN evidence_tier TEXT,
  ADD COLUMN fact_role TEXT,
  ADD COLUMN business_time TIMESTAMPTZ,
  ADD COLUMN confidence NUMERIC(3,2);
```

**db.ts AtomRow / FactAtomRecord 加字段**：
```typescript
export interface AtomRow {
  // ...现有字段
  epistemicStatus: 'observed' | 'reported' | 'derived' | 'inferred' | 'hypothesized' | 'expert_confirmed'
  evidenceTier?: 'behavior' | 'verbatim' | 'repeated' | 'cross_scene' | 'outcome_checked'
  factRole?: 'presenting' | 'trigger' | 'response' | 'counter' | 'context'
  ecologicalLayer?: 'micro' | 'meso' | 'exo' | 'macro' | 'chrono'
  businessTime?: string
  confidence?: number  // 0-1
}
```

**pipeline.ts 补映射**（消除"抽取时丢"）：
```typescript
// L113-128 构造 AtomRow 时补
const atomRows: AtomRow[] = atoms.map((a, i) => ({
  // ...现有映射
  epistemicStatus: a.epistemicStatus || 'reported',  // 默认 reported
  evidenceTier: a.evidenceTier,        // ← 不再丢
  factRole: a.factRole,                // ← 不再丢
  ecologicalLayer: a.ecologicalLayer,  // ← 不再丢
  businessTime: a.businessTime,
  confidence: a.confidence,
}))
```

**ExtractedAtom 接口补 epistemicStatus**（pipeline.ts L18-28）：
```typescript
interface ExtractedAtom {
  // ...现有
  epistemicStatus?: 'observed' | 'reported' | 'derived' | 'inferred' | 'hypothesized'
  businessTime?: string
  confidence?: number
}
```

**episodeExtractor SP 补产出要求**：要求 LLM 对每条 atom 标 epistemicStatus（observed/reported/inferred）+ businessTime + confidence。

### 3.2 EvidenceRef 正式类型（最短板 3）

**database.ts 顶部新增**（替代 updaters.ts 弱化版）：
```typescript
export type EvidenceSource = 'child_quote' | 'parent_statement' | 'behavior_observation' | 'entry_evidence' | 'transcript'

export interface EvidenceRef {
  evidenceId: string       // 指向 fact_atoms.atom_id 或 evidence_episodes.episode_id
  weight: number           // 0-1，该证据对当前判断的贡献
  quote: string            // 原话片段（人类可读）
  source: EvidenceSource
  observedAt: string       // 业务时间
  epistemicStatus: 'observed' | 'reported' | 'derived' | 'inferred'
}
```

### 3.3 TriangulatedFact 类型（dossier confidence 硬公式基础）

```typescript
export interface TriangulatedFact {
  factId: string
  content: string
  sources: EvidenceSource[]
  sourceCount: number
  independenceScore: number  // 0-1
  confidence: number         // 硬公式：单源≤0.5 / 双源0.6-0.7 / 三源≥0.8
  evidenceRefs: EvidenceRef[]
}
```

### 3.4 CandidateMechanism 升级

```typescript
export interface CandidateMechanism {
  // ...现有
  sceneReadings?: DossierSceneReading[]    // ← 新增，从 dossier 层下放
  relatedMechanismIds?: MechanismEdge[]    // ← 新增，机制间关系边
  supportingEvidence: EvidenceRef[]        // ← string[] 升级
  overallStrength: number                  // ← EvidenceStrength 三档升级为 0-1
}

export interface MechanismEdge {
  fromMechanismId: string
  toMechanismId: string
  relation: 'competesWith' | 'reinforces' | 'upstreamOf' | 'explainsSameBehavior' | 'contradicts'
  weight: number
  evidenceRefs: EvidenceRef[]
  sceneNote?: string
}
```

### 3.5 PendingHypothesis 升级为 BayesianHypothesis

```typescript
export interface BayesianHypothesis extends PendingHypothesis {
  prior: number                              // ← 新增
  likelihood: number                         // ← 新增
  posterior: number                          // ← 新增
  supportingEvidence: EvidenceRef[]          // ← string[] 升级
  contradictingEvidence: EvidenceRef[]       // ← 新增（替代 possibleCounterEvidence）
  distinguishingEvidence: string             // ← 新增
}
```

### 3.6 DossierPrediction 加 confidence

```typescript
export type DossierPrediction = {
  id: string
  text: string
  status?: DossierPredictionStatus
  confidence?: number      // ← 新增 0-1
  evidenceRefs?: EvidenceRef[]  // ← 新增
}
```

### 3.7 FamilyAgentPersona 新类型

```typescript
export type FamilyAgentPersona = {
  familyId: string
  parentTraits: { anxietyLevel: number; controlTendency: number; reflectivity: number }
  childTraits: { ageStage: string; temperament: string }
  familyClimate: { conflictFrequency: number; supportLevel: number }
  toneCalibration: 'gentle' | 'direct' | 'analytical'
  questionStrategy: 'probe_feeling' | 'probe_behavior' | 'probe_context'
  updatedAt: string
  version: number
}
```
持久化：memory_layer_items 新增 `layer_name = 'family_agent_persona'`。

### 3.8 RetrievedContext 加 domainAtomFacts

```typescript
export interface RetrievedContext {
  // ...现有 12 字段
  domainAtomFacts?: string[]  // ← 新增第 13 字段，atom 独立通道
}
```
FRONTEND_READ_PACK_KEYS 加第 12 键 `domainAtomFacts`（放后缀区，每轮变）。

---

## Part 4 · SP 层改造（厚 SP + harness 段 + 前后台术语统一）

### 4.1 前后台术语统一表（消除"SP 写 A 代码叫 B"）

| 统一术语 | 前台 SP 用 | 后台 SP 用 | 代码字段 | 契约字段 |
|---|---|---|---|---|
| 原子事实 | atom | atom | fact_atoms.content | atom（新契约） |
| 认识论状态 | epistemicStatus | epistemicStatus | epistemic_status | epistemic_status |
| 证据引用 | evidenceRef | evidenceRef | EvidenceRef | evidenceRefs |
| 场景解读 | sceneReading | sceneReading | DossierSceneReading | sceneReadings |
| 工作假设 | workingHypothesis | workingHypothesis | dossier.workingHypothesis | workingHypothesis |
| 备择解释 | alternativeReading | alternativeReading | alternativeReadings | alternativeReadings |
| 把握度 | confidence | confidence | confidence (0-1) | confidence |
| 机制矩阵 | matchedMechanisms | candidateMechanismMatrix | candidateMechanismMatrix | matchedMechanisms |

**硬规则**：所有 SP 改写时必须用此表的统一术语，禁止同义异名。

### 4.2 parentFacingStyle.md 改造（241→500+）

**保留**：§一身份 / §三通读义务 / §五追问 / §九字数 / §十一禁止清单 / §十六十七自检

**新增 harness 段**：
- **§十八 事实锚定决策树**：什么情况引用 ≥2 条 atom；引用类型（child_quote 优先）；缺时写"还需要更多场景"
- **§十九 替代解释硬规则**：何时列 ≥1 竞争假设；如何呈现"机制判断 X，但你提到 Y，这次可能不是 X"
- **§二十 把握度标尺**：3 条证据→低；10 条→中；50 条→高；数据不够→"信息不足"而非硬猜
- **§二十一 认识论隔离**：observed/reported/inferred 不得混用；inferred 必须标"推测"
- **§二十二 edge case**：pack 空时 / pack 极厚时 / 证据冲突时
- **§二十三 反套模板**：连续 3 轮同 mechanism 句式→强制换视角
- **§二十四 非归罪语言校准 scale**：从"你是…型"到"在这些情境中"的改写规范
- **§二十五 persona 适配**：读 family_agent_persona 调关注点敏感度/语言温度/提问策略

### 4.3 portraitSynthesizer.md 改造（221→500+）

**保留**：证据分层硬规则 / 交织纪律 / 20 条硬规则 / 七段规范 / 来源标签映射 / 反模式

**新增 harness 段**：
- **认识论隔离段**：observed/reported/derived/inferred 传播权限；hypothesized 不得升级为 observed
- **φ_r 消息函数段**：不同关系类型用不同消息函数；五个"不能线性相加"
- **贝叶斯更新段**：先验来自 THEORY_CARDS；少量证据做似然更新；数据不够降 confidence
- **防塌缩段**：5 视角头 focalDimension 正交；产出后相似度检查 >0.85 则降权
- **稀疏数据诚实段**：3 条证据时 dossier 长什么样（少而诚实）vs 50 条（丰富）
- **EvidenceRef 硬规则**：每个 factor/mechanism 必须引用 ≥1 EvidenceRef；confidence 由 TriangulatedFact 聚合，非 LLM 主观打
- **机制关系图段**：mechanism 间必须标 ≥1 competesWith 边；每个机制 ≥2 sceneReadings 且 protectiveMix 差异 >0.3
- **worked example 补充**：2-3 户不同数据量家庭样例

### 4.4 dailyDialogueOrchestration.md 改造（137→400+）

新增：prose 模式决策树 / 追问问题库 / edge case / 认识论隔离 / 把握度标尺 / persona 适配

### 4.5 parentFacingCopy.md 改造（109→300+）

新增：事实锚定（section 同 daily 纪律）/ 替代解释 / 认识论隔离 / 非归罪

### 4.6 secondMeCollaboratorIdentity §A+§C 改造（70→200+）

§A 加：宏观地图使用指南 / 重构四层操作规范
§C 加：判断定位决策树 / 机制链操作铁律细化 / 认识论隔离

### 4.7 episodeExtractor SP 改造（atom 抽取源头）

**关键**：这是认识论隔离的起点。要求 LLM 对每条 atom 产出：
- epistemicStatus（observed/reported/inferred）
- evidenceTier（behavior/verbatim/repeated/cross_scene/outcome_checked）
- factRole（presenting/trigger/response/counter/context）
- ecologicalLayer（micro/meso/exo/macro/chrono）
- businessTime（事件发生时间，非写入时间）
- confidence（0-1）

---

## Part 5 · 契约层改造（修过时 + 补缺失）

### 5.1 修过时契约（P0，会误导开发）

**memory-write.md**：
- 删除"memory_write → deep_mechanism_review(每日桶)"（PR-B3 已移除）
- 补"episode_ingest → deep_mechanism_review（15min debounce）"
- 补"memory_write → dossier_patch（非 counter_evidence 且有 newFacts）"

**read-contract.md**：
- 厚包上限同步代码 SLICE_LIMITS_THICK（8 处翻倍）
- 补 domainAtomFacts 第 12 键
- 显式列出 recentDiagnosis 为 BACKEND_ONLY

### 5.2 补缺失契约（P1）

**新建 docs/contracts/dossier-schema.md**：
- FamilyUnderstandingDossier 10 段完整 schema
- DossierFactor / DossierSceneReading / DossierPrediction / DossierAlternativeReading 子类型
- dossierSlice 切片规则（sliceForDaily）
- ecologicalCalibration 内部段不进 dossierSlice 规则

**新建 docs/contracts/atom-episode-schema.md**：
- fact_atoms 表 15 列（含新增 5 列）
- AtomRow / FactAtomRecord 字段
- epistemic_status 枚举与传播权限
- evidence_tier / fact_role 枚举
- is_high_value 判定规则

**扩展 memory-write.md 或新建 docs/contracts/jobs-contract.md**：
- 17 个 JobType 完整触发条件 + 链式 + 幂等键
- 补 11 个无契约 job：dossier_patch / daily_deep / profile_rewrite / growth_trajectory_update / profile_build_run / family_memory_feed_rebuild / weekly_handbook_update / time_capsule_update / handbook_page_admit / handbook_backfill / handbook_purge_bad_pages

**扩展 memory-read.md**：
- RetrievedContext 13 字段完整表（含 domainAtomFacts）
- 标注 recentDiagnosis 为 BACKEND_ONLY

### 5.3 补字段契约（P2）

在对应契约段补：confidence（0-1 数值，非三档）/ evidenceRefs（EvidenceRef 结构）/ sceneReadings（切片格式）

---

## Part 6 · harness 层改造（post-gate 确定性校验）

### 6.1 三层 harness 结构

```
[pre-gate] 调用 LLM 前
  - 注入硬约束清单（事实锚定 ≥2 / 替代解释 ≥1 / 把握度标注 / 认识论隔离）
  - 注入 family_agent_persona
  - 注入 retrievalPack（厚）

[LLM 调用] 厚 SP（cache 命中）+ 厚 payload
  - system = 厚 SP（500+ 行，cache 几乎免费）
  - user = task + retrievalPack + persona + harness 约束清单

[post-gate] LLM 产出后（确定性代码，非 LLM）
  - 校验 1：引用率——回答引用 ≥2 条本家庭 atom？没有→重产
  - 校验 2：替代解释——列 ≥1 竞争假设？没有→重产
  - 校验 3：把握度——标 confidence？数据不够时说"信息不足"？没有→重产
  - 校验 4：禁用词——"你是…型""根本原因就是"？有→重产
  - 校验 5：套模板——连续 3 轮同 mechanism 句式？是→强制换视角
  - 校验 6：认识论——inferred 当 observed？是→重产
  - 校验失败→重产（最多 2 次）→仍失败→降级"诚实承认信息不足"
```

### 6.2 post-gate 是确定性 TypeScript 函数

新建 `src/lib/server/harness/post-gate.ts`：
```typescript
export interface PostGateResult {
  passed: boolean
  failures: string[]
  action: 'accept' | 'retry' | 'degrade'
}

export function validateFrontendOutput(
  output: string,
  retrievalPack: FrontendReadSchema,
  recentMechanismHistory: string[],
): PostGateResult {
  // 6 项校验，返回通过/失败/动作
}
```

**关键**：post-gate 是代码，不是 LLM。SP 写了硬规则 LLM 也可能不守，post-gate 用代码校验"不守就打回"。

### 6.3 execution alignment（Harness-Bench 核心概念）

保持四者对齐：
- Agent 推理了什么 ↔ 工作区记录了什么（atom/evidence/dossier 持久化）
- 工具返回了什么 ↔ 评估检查了什么（post-gate 校验）

三者脱节 = bookkeeping 失败 = 88% 的 agent 失败主因（业界实证）。

---

## Part 7 · 链路层改造（写入批量 + 读取双引擎 + cache）

### 7.1 写入链（product-memory-architecture Layer 1）

- route.ts 不再每轮 enqueueJob('episode_ingest')，改暂存 pending_episode_buffer
- 批量触发：10 轮 / 登录 / 反证轮
- episode_ingest handler 改批量（text[] → N Episodes + M Atoms）
- 保留 turn_events 原话每轮存（cheap）

### 7.2 读取链（product-memory-architecture Layer 2）

- router.ts 不打平 atom，新增 domainAtomFacts 独立通道（保留 sourceType）
- 检索 query 拼接：section 类型 + 近 3 轮主题 + 行为信号 + userText
- hidden section 不丢 pack（parent-facing-copy L106-117 改）
- how-to-speak 补 dossierSlice（route L103-137 改）
- domain-selected aggregation：retrieval relevance gate 过滤无关 atom

### 7.3 prompt cache（product-memory-architecture Layer 3）

- FRONTEND_READ_PACK_KEYS 键序重排：dossierSlice 下移到后段
- retrieval-session-cache.ts 接线 + 主题漂移检测（相似度 <0.6 失效）
- legacy monolith 补 THEORY_CARDS systemSuffix

---

## Part 8 · 全链路一致性校验矩阵

**这是防"最短板"的核心工具**：每个关键字段从 SP→类型→DB→契约一一对账。

| 字段 | SP 要求 | 类型定义 | DB 列 | 契约记录 | 前台消费 | 状态 |
|---|---|---|---|---|---|---|
| epistemicStatus | §二十一要求 | AtomRow 加 | fact_atoms 加 | atom-契约补 | post-gate 校验 | 待补全 |
| evidenceTier | episodeExtractor 产出 | ExtractedAtom 有 | fact_atoms 加 | atom-契约补 | — | 待映射 |
| factRole | episodeExtractor 产出 | ExtractedAtom 有 | fact_atoms 加 | atom-契约补 | — | 待映射 |
| confidence | §二十要求 | DossierFactor 有 / Prediction 加 | — | dossier-契约补 | post-gate 校验 | 部分有 |
| EvidenceRef | §事实锚定要求 | database.ts 新增 | — | atom-契约补 | retrievalPack | 待新增 |
| sceneReadings | portraitSynthesizer 交织纪律 | DossierSceneReading 有 | — | dossier-契约补 | dossierSlice | 已有待补契约 |
| domainAtomFacts | 双引擎要求 | RetrievedContext 加 | — | read-contract 补 | 第 12 键 | 待新增 |
| alternativeReadings | §十九要求 | DossierAlternativeReading 有 | — | dossier-契约补 | dossierSlice | 已有 |
| family_agent_persona | §二十五要求 | FamilyAgentPersona 新增 | memory_layer_items 加 | 新契约 | user payload | 待新增 |

**校验规则**：任何一行有"待补全/待映射/待新增"的，都是链路断点，必须在该层改造时同步补齐。

---

## Part 9 · 落地顺序（木桶驱动，先补最短板）

### 阶段 A · 补 DB+类型最短板（1-2 天，效果瓶颈）

| 任务 | 文件 | 对应最短板 |
|---|---|---|
| fact_atoms 加 5 列 + AtomRow 加字段 | db.ts | 最短板 1+2 |
| pipeline.ts 补 evidenceTier/factRole/epistemicStatus 映射 | episode/pipeline.ts | 最短板 1 |
| ExtractedAtom 补 epistemicStatus/businessTime/confidence | episode/pipeline.ts | 最短板 2 |
| EvidenceRef 正式类型 | database.ts | 最短板 3 |
| TriangulatedFact 类型 | database.ts | dossier confidence 基础 |
| FamilyAgentPersona 类型 | database.ts | persona 基础 |
| RetrievedContext 加 domainAtomFacts | database.ts | 读取双引擎 |
| CandidateMechanism 升级（sceneReadings/边/EvidenceRef[]/0-1） | database.ts | 机制网络 |
| BayesianHypothesis 升级 | database.ts | 假设池 |
| DossierPrediction 加 confidence + evidenceRefs | family-understanding-dossier.ts | 预测权重 |

### 阶段 B · 补 SP harness 段 + 前后一致术语（3-5 天）

| 任务 | 文件 |
|---|---|
| episodeExtractor SP 补 epistemicStatus 产出要求 | prompts/background/episodeExtractor.md |
| parentFacingStyle 加 §十八-§二十五 harness 段 | prompts/core/parentFacingStyle.md |
| portraitSynthesizer 加认识论/贝叶斯/防塌缩/EvidenceRef 段 | prompts/background/portraitSynthesizer.md |
| dailyDialogueOrchestration 加 harness 段 | prompts/front/dailyDialogueOrchestration.md |
| parentFacingCopy 加事实锚定段 | prompts/front/parentFacingCopy.md |
| secondMeCollaboratorIdentity §A+§C 加厚 | prompts/core/secondMeCollaboratorIdentity.md |
| 前后台术语统一（Part 4.1 表） | 所有 SP |

### 阶段 C · post-gate harness 校验（2-3 天）

| 任务 | 文件 |
|---|---|
| 新建 post-gate.ts（6 项校验） | src/lib/server/harness/post-gate.ts |
| daily prose 调用接 post-gate | prose-context.ts |
| section copy 调用接 post-gate | parent-facing-copy.ts |
| 重产/降级逻辑 | harness/ |

### 阶段 D · 补契约（2-3 天，可与 B/C 并行）

| 任务 | 文件 |
|---|---|
| 修 memory-write.md 过时（PR-B3） | docs/contracts/memory-write.md |
| 修 read-contract.md 厚包上限 8 处 | docs/contracts/read-contract.md |
| 新建 dossier-schema.md | docs/contracts/dossier-schema.md |
| 新建 atom-episode-schema.md | docs/contracts/atom-episode-schema.md |
| 补 11 个 job 契约 | docs/contracts/jobs-contract.md |
| 补 RetrievedContext 13 字段 | docs/contracts/memory-read.md |

### 阶段 E · 前台消费修复（1-2 天）

| 任务 | 文件 |
|---|---|
| hidden 不丢 pack | parent-facing-copy.ts L106-117 |
| how-to-speak 补 dossierSlice | how-to-speak/route.ts L103-137 |

### 阶段 F · 链路改造（1-2 周，成本优化，后做）

| 任务 | 文件 |
|---|---|
| 写入批量（episode_ingest 不每轮） | route.ts + queue.ts + pipeline.ts |
| 读取双引擎（domainAtomFacts 独立通道） | router.ts + frontend-read-pack.ts |
| cache 落地（键序重排 + session cache） | frontend-read-pack.ts + pipeline.ts |

### 阶段 G · 深度画像 v4（2-4 周，理论落地）

| 任务 | 文档 |
|---|---|
| 5 视角头并行 + 防塌缩 | deep-portrait-v4 |
| 三角验证 confidence 硬公式 | deep-portrait-v4 |
| 机制关系图 + 贝叶斯假设池 | deep-portrait-v4 |
| persona 生成/更新逻辑 | sparse-data-harness |

---

## Part 10 · 分工与验收

### 10.1 分工

| 阶段 | 适合谁 | 理由 |
|---|---|---|
| A（DB+类型） | Cursor | 字段加列+映射，改动明确 |
| B（SP 加厚） | Trae | SP 是 Trae 主场，上下文长 |
| C（post-gate） | Cursor | 确定性 TS 函数 |
| D（契约） | Trae | 契约需理解全链路 |
| E（前台修复） | Cursor | 小断点 |
| F（链路） | Cursor(route/queue) + Trae(router/SP) | 拆分 |
| G（v4） | Trae | 理论落地+SP |

### 10.2 验收（全链路一致性）

**字段一致性**（Part 8 矩阵全部"已对齐"）：
```bash
# 脚本校验：SP 提到的字段名 vs 类型定义 vs DB 列 vs 契约文档
node scripts/audit-field-consistency.mjs
```

**post-gate 通过率**：
- LLM 产出一次过 ≥ 90%
- 失败重产后通过 ≥ 80%
- atom 引用率 ≥ 80%
- 连续 3 轮同 mechanism → 判 fail

**认识论隔离**：
- fact_atoms 表 epistemic_status 非空率 100%
- hypothesized 状态的 atom 不出现在 supportingEvidence 里

**稀疏数据诚实**：
- 3 条证据家庭 dossier 有"信息不足"标注
- 50 条证据家庭 dossier 有 ≥2 中高置信假设

**契约同步**：
- memory-write.md 无过时链
- read-contract.md 厚包上限 = 代码值
- 17 个 job 全有契约

---

## Part 11 · 系统工程论提醒（贯穿执行）

用户原话："在系统工程论中，任何东西它的短板是最可怕的。比如可能你准备了很多的理论，但是在 Agent 中就没有写得很薄，或者说字段不匹配，或者说什么什么的。"

**执行铁律**：
1. **每改一层，同步改全链路**——改类型必同步改 DB 列 + SP 术语 + 契约文档 + 前台消费
2. **不允许"待补全"残留**——Part 8 矩阵每一行必须在对应阶段全部对齐
3. **post-gate 是最后防线**——即使 SP 漏了规则，post-gate 用代码兜底
4. **先补效果瓶颈（A-E），后做成本优化（F）**——不补 A-E，F 做了也白做
5. **稀疏数据下诚实 > 推理能力**——数据不够时"信息不足"比硬猜好

---

## 附录 · 关键文件索引

| 层 | 文件 | 改造内容 |
|---|---|---|
| DB | [db.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/db.ts) | fact_atoms 加 5 列 + AtomRow 加字段 |
| 类型 | [database.ts](file:///Users/mac/Desktop/育见-2/src/types/database.ts) | EvidenceRef + TriangulatedFact + CandidateMechanism 升级 + BayesianHypothesis + RetrievedContext 加 domainAtomFacts |
| 类型 | [family-understanding-dossier.ts](file:///Users/mac/Desktop/育见-2/src/types/family-understanding-dossier.ts) | DossierPrediction 加 confidence + evidenceRefs |
| 抽取 | [episode/pipeline.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/episode/pipeline.ts) | 补映射 + ExtractedAtom 补字段 |
| SP | [prompts/core/parentFacingStyle.md](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) | 加 §十八-§二十五 harness 段 |
| SP | [prompts/background/portraitSynthesizer.md](file:///Users/mac/Desktop/育见-2/prompts/background/portraitSynthesizer.md) | 加认识论/贝叶斯/防塌缩/EvidenceRef 段 |
| SP | [prompts/background/episodeExtractor.md](file:///Users/mac/Desktop/育见-2/prompts/background/episodeExtractor.md) | 补 epistemicStatus 产出要求 |
| harness | src/lib/server/harness/post-gate.ts（新建） | 6 项校验 |
| 契约 | [docs/contracts/memory-write.md](file:///Users/mac/Desktop/育见-2/docs/contracts/memory-write.md) | 修过时 + 补链 |
| 契约 | [docs/contracts/read-contract.md](file:///Users/mac/Desktop/育见-2/docs/contracts/read-contract.md) | 修厚包上限 + 补 domainAtomFacts |
| 契约 | docs/contracts/dossier-schema.md（新建） | dossier 10 段 schema |
| 契约 | docs/contracts/atom-episode-schema.md（新建） | atom 15 列 schema |
| 前台 | [parent-facing-copy.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts) | hidden 不丢 pack |
| 前台 | [how-to-speak/route.ts](file:///Users/mac/Desktop/育见-2/app/api/daily/how-to-speak/route.ts) | 补 dossierSlice |
