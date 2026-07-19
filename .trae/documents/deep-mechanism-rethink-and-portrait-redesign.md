# 深度机制链重构 · episode/memory 区别 · 整合画像试验

> 状态：**思考与提案阶段，不改代码**。用户将另行发送理论资料，本文档第一部分（分析与试验样例）现在交付审阅，第二部分（大重构）待资料后迭代。
> 关联：BFF 三段式（①规则编排不调LLM ②组装厚包retrievalPack+digest ③LLM写prose/卡）保持不变，本次只动 ②里的 digest 形态与后台机制链产出。

---

## Part 1 · Job A `episode_ingest` vs Job B `memory_write`（详细对比）

两者都是后台 Job（`job_queue` 表，PG + SKIP LOCKED 认领、指数退避重试），但**写入目标、数据形态、检索用途完全不同**。

| 维度 | Job A `episode_ingest`（情景/原子证据摄入） | Job B `memory_write`（记忆写入） |
|------|------------------------------------|--------------------------|
| **核心文件** | [episode/pipeline.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/episode/pipeline.ts) `ingestEpisodeStrict` | [write/decision-engine.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/write/decision-engine.ts) `executeWritePlan` |
| **SP** | `episodeExtractor`（抽取） | `memoryWrite`（只输出写入计划 JSON） |
| **输入** | 家长**原始文本**（一段话/一次材料/一次反证） | 一个**结构化写入计划** `MemoryWritePlan`（由调用方组装） |
| **产出形态** | 两层**向量化**结构：`EvidenceEpisode`（语义完整召回单元）+ `FactAtom`（原子证据） | 分层**结构化**记录，落 ~9 张记忆层表，**不向量化** |
| **向量化策略** | Episode 总向量化；只有**高价值** Atom（`child_quote`/`material_observation`/`counter_evidence`/`feedback`）单独向量化，普通 Atom 依附 Episode | 不向量化；靠 `retrievalTags`/字段化检索 |
| **落库表** | `evidence_episodes`（pgvector HNSW 余弦）+ `fact_atoms` | `memory_layer_items` 多层：`entry_evidence_packs`/`evidence_networks`/`child_structure_models`/`conditional_profiles`/`pending_hypotheses`/`family_interaction_cycles`/`parent_narrative_patterns`/`daily_updates`；死层 `raw_materials`/`cleaned_facts`/`retrieval_indexes` 默认停写 |
| **幂等** | `episodeId` 确定派生（req token 或 sha(text)）；atom DELETE-then-insert 防孤儿 | 各层 upsert by itemId；`oldItemsToSupersede` 显式废弃 |
| **失败语义** | pgvector 不可用 → `EPISODE_VECTOR_UNAVAILABLE` fail-fast（不耗尽 attempts） | 异常上抛→重试；各层独立 upsert |
| **触发点** | 日常**反证轮**（counter_evidence）、采集模块完成、材料理解、任务创建 | 日常有效轮（非 safety/insufficient/短寒暄）、综合/诊断、采集完成 |
| **链式** | 不链式（叶子 Job） | 写完链式触发 `digest_update`（日桶）+ `model_review`（日桶，仅有假设时）+ `deep_mechanism_review`（日桶） |
| **检索用途** | **语义召回**：按本轮话题向量检索回"这家人发生过什么片段"（`searchEpisodes`/`searchHighValueAtoms`） | **字段化读取**：前台厚包按字段取"我们怎么理解这孩子"（画像/机制/假设/互动环） |
| **一句话** | 写"**发生过什么**"（原始事实，可被语义找回） | 写"**我们怎么理解**"（结构化判断，供前台字段读取） |

**互补关系**：`memory_write` 让前台知道"我们对这孩子的结构化理解"；`episode_ingest` 让前台能"按本轮话题语义找回相关历史片段"。两者都写，但服务于检索的两个不同轴（结构轴 vs 语义轴）。

---

## Part 2 · 深度机制链 3 个优化点评估（现状 + 可行性）

### (a) "夸大为最近 100 条家长输入" —— **基本已实现，差最后一刀**

- **现状真源** [pipeline.ts:329](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L329)：`getMergedParentInputHistory(tenant, 100)` 已取 100 条。
  - `sourceFingerprint` 用 `inputHistory.slice(-100)` ✓（100 条进指纹）
  - 但 `sharedContext.dailyUpdates` 用 `inputHistory.slice(-30).map(h => h.text)` ✗（**只 30 条喂 LLM**）← 这就是用户看到的"30 条"
- **用户判断正确**：动态家长输入 token 相对固定理论框架很便宜。100 条家长输入假设每条 80 字 ≈ 8k 字 ≈ 12k token，相对 20 张理论卡 + 框架 SP（约 4-5k token 稳定前缀）确实是动态部分更值。
- **建议改动**：[pipeline.ts:352](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L352) `slice(-30)` → `slice(-100)`。**1 行，低风险**。
- **需验证**：`getMergedParentInputHistory` 实际返回条数与单条长度（避免 100 条 × 500 字 = 50k token 爆 prompt）。建议加 truncation：每条 `slice(0, 200)`。

### (b) `deepMechanismReview.md` prompt cache —— **可行，收益明确**

- **现状**：
  - SP（`deepMechanismReview.md` 约 135 行理论框架 + 输出格式）走 system，是稳定前缀 → DeepSeek 自动按前缀缓存，**SP 本身已能命中**。
  - 但 `THEORY_CARDS`（20 张卡 JSON，~2k token）作为 **user payload** 传（[pipeline.ts:449](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L449) `{ ecosystemMap, theoryCards: THEORY_CARDS }`）→ 每次算 miss token。
  - `ark-agents.ts` 已有 cache 观测（`logCacheHit` 读 `prompt_cache_hit_tokens`）。
- **建议改动**：把 `THEORY_CARDS` 固定文本从 user payload 移到 **theoryMatcher 的 system 尾部**（SP 之后），`ecosystemMap`（动态）留 user。理论卡那 ~2k token 进缓存前缀，命中价约 1/10。
- **注意**：深度链是 4 步（ecosystemClassifier → theoryMatcher → mechanismSynthesizer → structuralRiskExtractor），`deepMechanismReview.md` 只在 `runLegacyMonolith` 回退时单调用。真正高频的是 4 步链，prompt cache 优化要针对每步 SP 的稳定前缀。
- **收益量级**：理论卡 + SP 框架约 4-5k token 稳定前缀，命中后每次省 ~90% 该部分计费。深度链 4 步 × 日桶 + 10 轮 + 登录触发，长期收益可观。

### (c) "每 10 次对话再调用一次" —— **已存在，用户可能不知道**

- **现状真源** [turn-signal.ts:12](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/turn-signal.ts#L12)：`MILESTONE = 10`，`bumpEffectiveFamilyTurn` 在 [daily/stream/route.ts:148](file:///Users/mac/Desktop/育见-2/app/api/daily/stream/route.ts#L148) 经 `noteEffectiveFamilyTurn` 调用，每 10 有效轮触发 `deepMechanismTurnMilestoneKey`。
- **受开关控制**：`isDeepMechanismS2Enabled()`（[s2-flags.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/s2-flags.ts)），默认开（`DEEP_MECHANISM_S2` 未设或非 0/off/false）。
- **正交触发键（4 类，互不跳过）**：
  1. `deepMechanismBucketKey` — memory_write 链式日桶（每日 1 次）
  2. `deepMechanismDailyOpenKey` — 登录 daily-refresh（每日 1 次）
  3. `deepMechanismTurnMilestoneKey` — **每 10 有效轮**（用户要的）
  4. `deepMechanismEvidenceKey` — 每条新 Episode（单次）
- **结论**：用户诉求已满足。若觉得触发太频繁，可调 `MILESTONE` 到 15/20；若觉得太稀，已有日桶兜底。**无需新功能，可能只需告知用户它已在跑**。

---

## Part 3 · 机制卡模型批判 + 三步工作流重构方案

### 用户批评的精准性（代码证实）

1. **THEORY_CARDS 骨架化** [theory-cards.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/theory-cards.ts)：20 张卡每张只有 `id/name/ecosystemLayer/applicableScenarios(3-4个词)/observationSignals(3-4个词)`。无理论内核、无判断逻辑——只是标签袋。
2. **机制名套卡** [deepMechanismReview.md:130](file:///Users/mac/Desktop/育见-2/prompts/background/deepMechanismReview.md#L130)：`mechanismName` 必须形如"理论名：具体家庭结构"，`theoryCardId` 是结构化字段。
3. **digest 套 topMechanism** [digest-builder.ts:61](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/digest-builder.ts#L61)：`mechanismNarrative = topMechanism.description + 理论路由线索 + 生态层覆盖`——确实是"套卡 description"。
4. **前台套卡** [pick-deep-model-digest.ts:93](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts#L93) `formatMatchedMechanismCards`：输出"名。描述。依据：xxx。可能在保护：xxx"——**确实像豆包**，单薄、标签化、无整合。

用户的核心洞察正确：**"回家写作业→父母争吵→孩子躲闪→逃避"不是机制，是现象/场景**。当前系统把现象当机制，又把机制卡当衡量标尺，导致：
- 新结论不知更新哪张卡（卡之间无权重消长模型）
- 前台套几张卡，回答单薄
- 感受不到家庭理解深度

### 用户要的三步工作流

1. **家长输入大量文字**
2. **拆分为经典事实 / 不同分类**
3. **根据分类 + 理论，综合归纳为一个自洽、完整的孩子理解**（不是 20 张分散卡）

### 重构核心转变

| 旧模型 | 新模型 |
|--------|--------|
| 事实 → 匹配 20 张卡 → 每条机制=卡+事实 → 矩阵 10-20 条 → digest 取 top 机制 description | 事实 → 分类 → 理论作"思考透镜"（不输出卡）→ 产出**一个整合性孩子理解叙事**（分层但连贯） |
| `theoryCardId` / `mechanismName="理论名：..."` 暴露给输出结构 | 理论是内部推理骨架，**不出现在输出字段** |
| 置信度 = 卡匹配数 + 跨场景 | 置信度 = **同一保护功能跨场景复现一致性** + 反证核查 |
| 卡之间无权重消长 | 保护功能有连续权重，新证据升/降，反证重置 |
| digest = topMechanism.description（套卡） | digest = 一段整合叙事 + 分层结构 + 证据锚点 |

### 新画像结构（`ChildPortrait v2`，不用机制卡做衡量）

```
ChildPortrait (孩子画像 v2)
├── coreUnderstanding (核心理解)
│   一段自洽因果叙事(200-400字)："这个孩子在___家庭结构里，
│   用___方式维持___，因为___"
│   不是"机制1+机制2"，而是一段连贯的"为什么"
├── structuralLayers (结构层，借生态系统分层但不命名卡)
│   ├── micro: 亲子直接互动的稳定模式(场景化叙事)
│   ├── meso: 跨系统协同(家校/共同养育)的张力
│   ├── exo: 外部压力如何渗入微系统
│   ├── macro: 文化/价值脚本如何塑形期待
│   └── chrono: 时间转折前后变化(必须有前后对比才写)
├── protectiveFunctions (保护功能，孩子行为在保护什么)
│   不是"逃避机制"，而是"作业前拖延 = 保护休息边界与可控感"
│   多场景指向同一功能 = 高置信；这是权重的连续轴
├── interactionDynamics (互动动力学，借强制循环/依恋但不贴标签)
│   "家长A动作 → 孩子B接收 → 孩子C反应 → 家长D解读 → 强化E"
│   作为动态链叙事，不是静态卡名
├── evidenceAnchors (证据锚点)
│   每条理解挂 ≥2 条具体事实/原话；无锚点的理解不输出
├── openQuestions (开放假设，待验证)
│   不下结论，"在某场景可能因为…，需观察…"
└── growthEdge (成长着力点，培优语气)
    基于理解，一个小场景试不同回应
```

**关键设计决策（待用户理论资料确认）**：
- `coreUnderstanding` 是否由 LLM 一次生成（整合叙事），还是确定性拼接+LLM 润色？倾向前者：整合性必须靠 LLM 一次成文，确定性拼接拼不出"自洽"。
- `structuralLayers` 是否保留 5 层？用户批评"分散"，但分层≠分散——分层是组织，分散是并列无关联。保留分层但强制成一段连贯叙事的"章节"，而非独立卡。
- 权重消长模型：保护功能的置信度从离散 `low/medium/high` 改为连续 `0-1`？需理论资料支撑。

### 前后台联动改造（BFF 三段式不变，只换 digest 形态）

- **后台** `deep_mechanism_review` 链产出从 `candidateMechanismMatrix`(卡矩阵) → `ChildPortrait`(整合画像)。`mechanismSynthesizer` SP 重写：不再要求"每条落理论卡"，改要求"产出一段整合叙事 + 分层 + 保护功能 + 证据锚点"。
- **digest** `buildDeepModelDigest` 从取 `topMechanism.description` → 取 `portrait.coreUnderstanding` + 分层摘要。
- **前台厚包** `pickDeepModelDigestPack` 字段从 `mechanismNarrative/matchedMechanisms(卡)` → `coreUnderstanding/structuralLayers/protectiveFunctions`。`formatMatchedMechanismCards` 废弃或降级为兜底。
- **前台 LLM** `dailyDialogueOrchestration` SP 改：从"引用 matchedMechanisms"→"引用 coreUnderstanding + protectiveFunctions"，让 prose 自然融入整合理解而非贴卡。

### 三步工作流第二步：事实分类 taxonomy（坐实现有分类）

用户三步工作流的第二步"拆分为经典事实/不同分类"，要落到现在已有的分类体系上重新设计，而非另起炉灶。现有两套分类：

- **episode_ingest 的 FactAtom**（[episode/pipeline.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/episode/pipeline.ts)）：`sourceType`（daily/homework/communication/family/material）+ `factType` + `isHighValue`；高价值类型 = `child_quote`/`material_observation`/`counter_evidence`/`feedback`。
- **memory_write 的 record types**（[write/decision-engine.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/write/decision-engine.ts)）：`raw_event`/`pending_hypothesis`/`stable_profile_update`/`correction_log`/`rehearsal_record`/`support_direction`/`parent_narrative_observation`。

**新分类法（面向整合画像，不面向卡）**：把"事实"按**它在画像里的结构角色**分五类，取代"按理论卡分"：

| 事实分类 | 旧对应 | 在画像里填哪个字段 | 例子 |
|---------|--------|-------------------|------|
| `actor_action`（谁做了什么） | raw_event | interactionDynamics / structuralLayers | "妈妈站旁边盯作业" |
| `child_reception`（孩子怎么接收） | child_quote / material_observation | interactionDynamics / protectiveFunctions | "他一拿笔我就问" → 孩子接收为被不信任 |
| `child_response`（孩子怎么反应） | child_quote | protectiveFunctions / interactionDynamics | "沉默""拖延""顶嘴" |
| `parent_interpretation`（家长怎么解读） | parent_narrative_observation | interactionDynamics 的"家长二次解读" | "妈妈解读为态度差" |
| `temporal_marker`（时间转折） | raw_event 带 timeline | structuralLayers.chrono | "升初一后冲突陡增" |

**关键转变**：旧分类是"这条事实像哪张理论卡"，新分类是"这条事实在因果链的哪个位置"。这样事实天然能拼成 `interactionDynamics` 的五步链（actor_action→child_reception→child_response→parent_interpretation→强化），而非散落卡上。`counter_evidence` 不再是独立分类，而是任何一类事实带的"反证标记"，直接进权重消长。

### 权重消长算法（连续置信度，取代卡匹配数）

用户核心诉求之一："机制卡之间也有彼此的权重的消长"。设计保护功能的**连续置信度模型**（0-1），取代离散 `low/medium/high`：

```
protectiveFunction.confidence 演算规则:
  初始: 首次出现单场景 = 0.3
  升:   跨场景复现 +0.15/场景（上限 +0.4）
        有具体原话锚定 +0.1
        跨时间稳定（>2周再现）+0.1
  降:   出现反证事实 -0.25
        仅家长单方陈述无孩子侧证据 -0.1
  重置: 2 条以上强反证 → 降为 openQuestion，移出 protectiveFunctions
  封顶: [0.0, 0.95]，永不写 1.0（保留"候选"性质）
```

**权重消长 vs 卡权重**：旧模型卡之间无关系，新模型保护功能之间有**互斥/共强**关系——例如"保护可控感"与"保护自尊"若同场景出现，共强；"保护可控感"与"对抗指挥"若行为重叠，合并为更高层功能。这需要在 mechanismSynthesizer SP 里显式要求"识别功能间的层级与重叠"，而非罗列。

**反证触发**（呼应前台 episode_ingest 的 counter_evidence）：前台每收到一条反证，不只是写 episode，还要 `bumpProtectiveFunctionConfidence(functionId, -0.25)`，并在下一次 deep_mechanism_review（10 轮里程碑）时让 LLM 重新评估该功能是否降级为 openQuestion。

### 后台深度链改造（4 步 → 3 步，产出整合画像）

现状 4 步链（[pipeline.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts)）：`ecosystemClassifier`（生态层）→ `theoryMatcher`（理论卡）→ `mechanismSynthesizer`（机制矩阵）→ `structuralRiskExtractor`（张力）。问题：theoryMatcher 把理论卡当产出锚点，mechanismSynthesizer 围绕卡组装矩阵。

**新 3 步链**（理论作透镜，不作出产）：

1. **`factTaxonomizer`**（取代 ecosystemClassifier 的前半）：把 100 条家长输入 + entryPacks 的事实按上表五类分类，输出结构化事实表（`{actor_actions, child_receptions, child_responses, parent_interpretations, temporal_markers}`）。这步是"拆分经典事实"的落点，纯分类不归因。
2. **`portraitSynthesizer`**（取代 theoryMatcher + mechanismSynthesizer）：输入事实表 + 20 理论卡（作 system 透镜，不出现在输出）+ 现有 cycles/hypotheses/profile。输出**一个 `ChildPortrait`**（coreUnderstanding 一段成文 + structuralLayers + protectiveFunctions 带连续置信度 + interactionDynamics + evidenceAnchors + openQuestions + growthEdge）。理论卡在 SP 里作为"思考时必须借用的框架"，但输出 schema 不含 `theoryCardId`/`mechanismName`。
3. **`structuralRiskExtractor`**（保留）：从 portrait 提取结构张力与安全风险，不变。

**prompt cache 收益放大**：第 2 步 `portraitSynthesizer` 的 system = `parentFacingStyle 不用` + `deepModelingParentDigest 框架` + 20 理论卡（固定）+ 输出 schema（固定），全部稳定前缀进缓存；user = 事实表（动态）。理论卡那 ~2k token 一次进缓存，长期命中。

### BFF 字段映射表（digest → 厚包 → 前台 LLM）

| 层 | 旧字段 | 新字段 | 出处 |
|----|--------|--------|------|
| 后台产出 | `candidateMechanismMatrix[].theoryCardId/mechanismName` | `portrait.coreUnderstanding + structuralLayers + protectiveFunctions` | portraitSynthesizer |
| digest 持久化 | `mechanismNarrative`(=topMechanism.description) | `coreUnderstanding`(整段) + `layerSummary`(5层摘要) + `topProtectiveFunctions`(带置信度top3) | digest-builder 改 |
| 前台厚包 `pickDeepModelDigestPack` | `matchedMechanisms`(=formatMatchedMechanismCards) | `coreUnderstanding` + `protectiveFunctions` + `interactionDynamics` | pick-deep-model-digest 改 |
| 前台 LLM SP 注入 | "引用 matchedMechanisms" | "引用 coreUnderstanding 说明这孩子为什么这样 + protectiveFunctions 说明行为在保护什么" | dailyDialogueOrchestration 改 |
| 前台 section 渲染 | judgmentDelta 套卡名 | judgmentDelta 用 coreUnderstanding 首句 | daily-turn-bff 改 |

**契约不变**：`DailyStreamEvent` / `DailySection` 形态不变（NDJSON 流式协议不动），只是 section 内容来源从"卡描述"变"整合叙事"。这是 BFF 三段式 ②③ 的内部改造，①规则编排不受影响。

---

## Part 4 · 试验性整合画像样例（不用机制卡）

> 假设家庭：小宇，男，13 岁初一。妈妈主诉：作业每天拖到 11 点，催就吵，最近一次把孩子房门踹了。四模块采集已有：学习作业(作业拖延+妈妈检查)、日常节奏(手机)、亲子沟通(顶嘴)、情绪压力(孩子沉默)。下面是**新模型会产出的画像**，对比旧模型会产出的卡列表。

### 旧模型产出（卡矩阵，单薄）

```
matchedMechanisms:
1. 强制循环理论：催促-拖延-升级-让步
2. 亲职风格理论：专制型(高要求低回应)
3. 自我决定理论：自主感受阻
4. 行为控制与心理控制：规则前后不一
digest.mechanismNarrative: "主1 强制循环理论：催促-拖延-升级-让步｜主2 亲职风格理论..."
```
→ 前台 prose 会变成"您家存在强制循环和专制型亲职…"——**像豆包**。

### 新模型产出（整合画像，自洽叙事）

```yaml
coreUnderstanding: |
  小宇在"妈妈独自管学习+爸爸长期缺位+初一课业陡增"的结构里，
  用"作业前拖延"维持两件事:对今晚节奏的一点可控感、
  以及在妈妈持续催促下保留"我没在听你指挥"的最后边界。
  催促升级到他房门被踹那刻,他学会的不是写快点,
  而是"沉默比顶嘴更安全"。妈妈越用力,孩子越退进沉默——
  这不是态度问题,是这套结构目前能维持的唯一稳态。

structuralLayers:
  micro:
    亲子直接互动已固化为"催→拖→升级→冷战"循环。
    妈妈的检查既是关心也是监控,孩子接收到的信号是"不被信任"。
    证据: "周一到周四妈妈都站旁边盯"(作业模块原话)、
          "他一拿笔我就问怎么还不开始"(妈妈原话)
  meso:
    爸爸不参与管学习,妈妈是唯一执行者也是唯一被对抗者。
    无第二养育者缓冲,冲突无出口。
    证据: "爸爸加班多,学习基本我管"(家庭模块)
  exo:
    初一课业量较小学陡增,妈妈对排名的焦虑来自外部比较。
    证据: "他们班好几个都上辅导班"(妈妈原话)
  macro:
    "严师出高徒""现在不抓以后来不及"的文化脚本驱动妈妈的紧迫感。
    证据: "我爸妈也是这么管我的"(家庭模块)
  chrono:
    升初一后冲突陡增(前后对比明确)。
    证据: "小学还好,上初中开始每天吵"(日常模块)

protectiveFunctions:
  - function: 保留对夜晚节奏的可控感
    behaviors: [作业前拖延, 先做副科不动主科]
    crossSceneConsistency: high  # 作业/手机/周末作业都出现
    confidence: 0.82
  - function: 在被指挥感下保留"我没在听你"的边界
    behaviors: [沉默, 不反驳也不执行]
    crossSceneConsistency: medium
    confidence: 0.65
  # 反证核查: 无反证。需观察"妈妈不在时他是否还拖延"——若不拖延,功能=对抗指挥而非任务难

interactionDynamics:
  "妈妈催促进度(怕落后) → 小宇接收为被不信任/被指挥 
   → 小宇用拖延与沉默保留边界 → 妈妈解读为态度差/懒 
   → 妈妈升级(踹门/加任务) → 小宇学会沉默更安全 → 强化"

evidenceAnchors:
  - "周一到周四妈妈都站旁边盯"(作业模块)
  - "他一拿笔我就问怎么还不开始"(妈妈原话)
  - "小学还好,上初中开始每天吵"(日常模块)
  - "把房门踹了"(情绪模块)
  - "我爸妈也是这么管我的"(家庭模块)

openQuestions:
  - 妈妈不在或爸爸管的晚上,小宇是否还拖延?(区分任务难 vs 对抗指挥)
  - 小宇沉默后,妈妈第二天是否会因愧疚而放松,形成间歇强化?

growthEdge:
  不从"改态度"入手。本周一个小场景: 选一晚,
  妈妈在作业开始前20分钟完全不进入他房间、不催,
  只在结束时问一句"今晚哪段最卡"。观察他是否仍拖延。
  目的不是治拖延,是测"拖延是否专为对抗指挥"。
```

### 新旧对比要点

| 维度 | 旧(卡) | 新(整合画像) |
|------|--------|-------------|
| 家长感受 | "它给我贴了4个理论标签" | "它说清了我家为什么会这样" |
| 可更新性 | 新事实不知更新哪张卡 | 保护功能置信度连续升降,反证重置 |
| 前台 prose | "您家存在强制循环…" | 自然融入"小宇用拖延保留可控感…" |
| 深度 | 标签并列 | 因果链连贯,结构→功能→证据 |
| 培优语气 | 中性诊断 | 着力点可执行、可验证 |

### 样例 2（不同家庭类型，验证模型适应性）

> 假设家庭：小萱，女，11 岁。妈妈主诉：孩子很懂事、总安慰我，但最近说不想上学、喊肚子疼。爸妈关系冷淡，妈妈常跟小萱说爸爸的不好。旧卡模型会把这归到"依恋理论：焦虑型"一张卡了事；新模型要说出"父母化/三角关系/情绪承接"的结构。

```yaml
coreUnderstanding: |
  小萱在"父母关系冷淡+妈妈把她当情绪出口"的结构里,
  早早学会了做妈妈的情绪照顾者——用懂事和安慰填补
  妈妈在婚姻里的缺口。这不是成熟,是这个家目前维持
  稳态的方式:妈妈有人倾诉就不必面对婚姻,小萱被需要
  就暂时安全。但代价是她承接了不该承接的成人情绪,
  自己的脆弱无处安放,只能身体化(肚子疼)和回避(不想上学)。
  她不是"焦虑依恋",她是被放在了不该站的位置上。

structuralLayers:
  micro:
    母女二元过度紧密,爸爸被排除在外。小萱是妈妈的情绪配偶而非孩子。
    证据: "她总安慰我,说妈妈别难过"(妈妈原话)、
          "我跟她说爸爸的不好她都听着"(妈妈原话)
  meso:
    父女互动稀少,爸爸缺位使母女更纠缠,无第三方松绑。
    证据: "她爸不怎么管,也不怎么说话"(家庭模块)
  exo: 无明显外部压力渗入(材料不足,留空)
  macro:
    "懂事的孩子=好孩子"的文化脚本让妈妈把父母化误读为优点。
    证据: "她从小就特别懂事,不像别人家孩子闹"(妈妈原话)
  chrono:
    近期出现躯体化与拒学,是承接超载的转折信号(需前后对比确认)。
    证据: "这学期开始喊肚子疼不想上学"(日常模块)

protectiveFunctions:
  - function: 被需要感带来的暂时安全
    behaviors: [主动安慰妈妈, 讨好, 压抑自己需求]
    crossSceneConsistency: high
    confidence: 0.78
  - function: 用身体化表达无法言说的承接超载
    behaviors: [肚子疼, 拒学]
    crossSceneConsistency: medium  # 仅本学期,需观察
    confidence: 0.55
  # 反证待观察: 若爸爸在场或妈妈情绪好时,小萱是否还躯体化

interactionDynamics:
  "妈妈向小萱倾诉爸爸不好(把配偶情绪外包) 
   → 小萱接收为'我得照顾妈妈' → 小萱用安慰与懂事回应 
   → 妈妈解读为'孩子贴心' → 妈妈继续倾诉,纠缠加深 
   → 小萱承接超载无处释放 → 身体化/拒学"

evidenceAnchors:
  - "她总安慰我,说妈妈别难过"(妈妈原话)
  - "我跟她说爸爸的不好她都听着"(妈妈原话)
  - "她从小就特别懂事"(妈妈原话)
  - "这学期开始喊肚子疼不想上学"(日常模块)

openQuestions:
  - 小萱躯体化是否在妈妈情绪低落日更频繁?(测承接超载假说)
  - 爸爸单独带小萱时,她是否表现出不同于"懂事"的状态?(测纠缠 vs 气质)
  - 妈妈是否意识到倾诉对象是孩子?(决定干预切入点)

growthEdge:
  不从"治拒学"入手。本周一个尝试: 妈妈在想说爸爸不好时,
  先停 3 秒问自己"这话该跟 11 岁的孩子说吗"。
  目的不是立刻停倾诉(会断裂妈妈唯一出口),而是让妈妈开始
  察觉"小萱在承接什么"。同时建议妈妈寻求成人倾诉渠道。
```

**样例 1 vs 样例 2 的模型适应性验证**：
- 样例 1（对抗/拖延型）：核心是"用对抗保护边界"，保护功能指向**对外抗拒**。
- 样例 2（纠缠/父母化型）：核心是"用承接换取安全"，保护功能指向**对内填补**。
- 同一套 `ChildPortrait` 结构容纳两种截然不同的家庭动力学，证明结构普适——关键是 `coreUnderstanding` 的整合叙事能力，而非卡的数量。

---

## Part 5 · Assumptions & Decisions

1. **本提案是思考交付，不改代码**（用户明确"先不要改代码"）。
2. **立即可做的小优化（低风险，待用户点头）**：
   - [pipeline.ts:352](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L352) `slice(-30)` → `slice(-100)`（每条 trunc 200 字）
   - THEORY_CARDS 从 user payload 移到 theoryMatcher system 尾部（prompt cache）
3. **大重构（整合画像）待用户理论资料**：理论资料到了之后，细化 `ChildPortrait v2` 的字段定义、置信度连续模型、SP 重写、digest 改造、前台厚包字段替换。这是多文件大改，需单独 spec。
4. **BFF 三段式不动**：①规则编排(不调LLM) ②组装厚包 ③LLM，本次只改 ②的 digest 形态与后台机制链产出，不破坏前台流式契约。
5. **机制卡不删除，降级为兜底**：整合画像产出失败时，回退旧卡矩阵，保证可用性。理论卡作为内部思考透镜保留在 SP，不进输出结构。
6. **试验样例的家庭是假设的**，仅为展示形态，非真实数据。

## Verification（思考阶段，验证=用户审阅）

1. 用户审阅 Part 1（episode vs memory 区别）是否清楚。
2. 用户确认 Part 2 的 3 个优化点现状（尤其"每10轮已存在"是否出乎意料）。
3. 用户审阅 Part 3 的三步工作流 + 新画像结构是否符合"整合而非分散"的意图。
4. 用户审阅 Part 4 的试验样例——这是核心: **这个形态的画像是不是你想要的"完整孩子理解"**？哪里要加/减/改？
5. 用户发送理论资料后，进入 Part 3 大重构的 spec 阶段。

## 下一步（等用户反馈）

- 若用户认可试验样例形态 → 我基于理论资料写 `ChildPortrait v2` 正式 spec（字段/置信度/SP/digest/前台厚包改造）。
- 若用户要调整形态 → 迭代 Part 4 样例。
- 小优化（100条/prompt cache）可独立先行，不依赖大重构。

---

## Part 6 · 迁移与兼容（大重构落地时的安全网）

新画像不一次性替换旧机制矩阵，**并行写入 + 优先读取 + 兜底回退**：

1. **数据并行**：`deep_mechanism_review` 链产出新 `ChildPortrait` 写入新记忆层 `child_portrait_snapshots`；旧 `candidateMechanismMatrix` 继续写 `evidence_networks`，不删不动。
2. **前台优先读新**：`pickDeepModelDigestPack` 先读 portrait，缺失则回退旧 `matchedMechanisms`（`formatMatchedMechanismCards` 降级为兜底，不删）。
3. **Feature flag 切换**：复用现有 `s2-flags.ts` 模式，加 `isPortraitV2Enabled()`（env `PORTRAIT_V2`，默认关）。关 = 旧链路全量；开 = 新链路产出 + 旧兜底。出问题一键切回。
4. **SP 版本并存**：新 `portraitSynthesizer` SP 与旧 `mechanismSynthesizer` SP 都进 `registry.generated.ts`，flag 决定调哪个，不覆盖。
5. **契约不变**：`DailyStreamEvent`/`DailySection`/`DailyAction` 形态不动（[packages/contracts/src/daily-stream.ts](file:///Users/mac/Desktop/育见-2/packages/contracts/src/daily-stream.ts)），小程序零改动。只换 section 内容来源。
6. **置信度迁移**：旧 `overallStrength: low|medium|high` → 新 `confidence: 0-1` 映射（low=0.3, medium=0.6, high=0.8），一次性补到现有 protectiveFunctions，后续按演算规则走。
7. **回滚验证**：切回旧链路后，前台 prose 应回到"套卡"形态（降级可接受），不能崩。

## Part 7 · 待理论资料确认的开放问题（不自行假设）

以下决策点**等用户理论资料到位后再定**，现在只列清单，不预设答案：

1. **`coreUnderstanding` 的内部结构**：一段连贯叙事（200-400字）是否够？还是需要内部分"结构—功能—代价"三段式？理论资料是否提供"家庭评估叙事"的标准写法？
2. **`structuralLayers` 五层是否都保留**：用户批评"分散"，但分层是组织不是分散。理论资料里 Bronfenbrenner 五系统是否必须全用？还是可收敛到 micro+macro+chrono 三层？
3. **保护功能的"互斥/共强"关系形式化**：用图（节点+边）？层级树？还是纯文字描述？理论资料是否有"功能层级"模型（如 Self-Determination 的三需求层级）？
4. **连续置信度的演算参数依据**：`+0.15/-0.25` 等是工程经验值还是有理论支撑（如证据等级评定量表）？是否需要引入"证据质量"维度？
5. **`growthEdge` 的家长可执行性校验**：着力点是否需要前置"家长承受力"评估（呼应 familyPlanner 的 boundaryFirst）？理论资料是否有"最小可承受改变"模型？
6. **`portraitSynthesizer` 单次成文 vs 草稿+精修**：一段高质量整合叙事，单次 LLM 调用能否稳定产出？是否需要"先出事实链草稿→再精修叙事"两步（多 1 次调用但质量稳）？这关系到 token 预算与质量权衡。
7. **理论卡的最终命运**：是彻底从输出结构消失（只在 SP 作透镜），还是降级为"后台自检清单"（LLM 生成 portrait 后用卡自检是否覆盖关键维度）？后者保留卡的校验价值但不让它污染输出。
8. **反证触发的实时性**：前台反证是否要即时 `bumpProtectiveFunctionConfidence`（同步、可能延迟前台），还是只标记、等 10 轮里程碑批量重算（异步、前台快）？倾向异步，但需确认。
9. **与小绘认知记忆的边界**：新 portrait 与现有 `child_structure_models`/`conditional_profiles` 是替代还是叠加？避免又造一个并行结构。
10. **画像更新频率**：10 轮里程碑 + 日桶是否够？还是保护功能置信度变化超阈值（如 -0.2）时即时触发增量重算？
