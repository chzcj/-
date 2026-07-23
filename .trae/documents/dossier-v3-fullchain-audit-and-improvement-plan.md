# 育见 dossier v3 全链路有效性审查 + 改进方案

> Trae 2026-07-19 产出。基于：3 条并行链路深审（产出/更新/消费）+ 登服务器实测真实数据 + 心理学/教育学理论。
> 替代 `.trae/documents/memory-utilization-audit-spec.md` 作为 dossier 专项的权威报告。

---

## 执行摘要（一页讲清楚）

### 你的核心痛点（原话）

> "AI 对于家长可能输入什么，我怎么做整理这一步都是在瞎猜的。他没有真正依靠我们怎么样实现，就是它，它是都是一步一步分块儿来的，它没有整体思维，也没有一个对用户的精准把握。"

### 服务器实测铁证（2026-07-19）

| 指标 | 实测值 | 判定 |
|---|---|---|
| 生产环境 `PORTRAIT_V3` 环境变量 | **未设**（默认关） | ❌ 整条 dossier v3 链从未跑过 |
| 34 个家庭的 `deep_model_digest.dossier` 字段 | **全部为 null** | ❌ 整合性画像从未生成 |
| `deep_mechanism_review` Job 历史成功数 | 177 次 | ✅ Job 在跑，但全走旧路径 |
| `dossier_patch` Job 历史成功数 | 8 次 | ⚠️ 全是空操作（flag 关 → return false） |
| 数据最多家庭的 `mechanismNarrative` | 336 字，含原话+因果链 | ✅ AI 有在工作 |
| 数据最多家庭的 `portraitCards.growth.summary` | LLM 产出，有质量 | ✅ 画像 Tab 有内容 |
| 数据最多家庭的 `evidence_networks.candidateMechanismMatrix` | **只有 2 条机制** | ⚠️ 机制矩阵严重稀疏 |

### 核心诊断

**不是"AI 完全没工作"**——`mechanismNarrative` / `portraitCards` 都有质量。

**真正的病根**是：

1. **整合性画像（dossier）从未生成**——`PORTRAIT_V3` 没开，前台 AI 只能靠"扁平碎片"（dossierSlice string[] / matchedMechanisms 名字）瞎猜，看不到 dossier 的结构化信息（predictions.status / interventionTargets.prediction / alternativeReadings.confidence）
2. **链路是"分块拼接"而非"整体理解"**——前台 SP 之间 dossier 信息量差异巨大：画像页 SP 按 v3 五段读 dossier 对象；交流/预演 SP 只读扁平 dossierSlice
3. **hidden section 在 dossier 成熟时反而丢 retrievalPack**——形成"dossier 越厚，原始事实锚点越少"的悖论
4. **更新链断裂**——counter_evidence 不触发 L2、predictions 可能空导致 L2 永不触发、dossier 无 freshness 检查
5. **机制矩阵严重稀疏**——数据最多家庭只有 2 条机制，说明 deep_mechanism_review 的理论匹配能力被 7 张 legacy 简版卡（exo/macro 层无 rich）拖累

### 改进方案三层

| 层 | 时间 | 动作 | 预期效果 |
|---|---|---|---|
| **Layer 1 · 小改（1-2 天）** | 立刻 | 开 `PORTRAIT_V3=1` + 修 5 个 P0 断点 | dossier 开始生成，前台能看到整合性画像 |
| **Layer 2 · 中改（1-2 周）** | 短期 | dossierSlice 保留结构化 + 所有 SP 按 v3 五段拆分 + 修更新链 4 个断点 | AI 有整体思维，不再瞎猜 |
| **Layer 3 · 大改（1-2 月）** | 中期 | 清理 dead layer + 补齐 THEORY_CARDS exo/macro + dossier 质量评分 + freshness 感知降级 | 记忆有效性与利用率最大化 |

---

## Part 1 · 服务器实测铁证（2026-07-19）

### 1.1 环境配置

```
生产目录：/home/ubuntu/apps/yujian/
PM2 进程：yujian + yujian-jobs（均 online）
.env.local 关键 flag：
  DATABASE_URL=postgresql://childos:***@127.0.0.1:5432/childos_mvp
  PORTRAIT_V3          ← 未设（默认关）
  FAMILY_MEMORY_THICK_PACK  ← 未设（默认开）
  CHILDOS_WRITE_DEAD_LAYERS ← 未设（默认停写）
  DEEP_MECHANISM_S2        ← 未设
```

**关键发现**：`PORTRAIT_V3` 环境变量未设 → [portrait-v3-flags.ts:3-6](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/portrait-v3-flags.ts#L3-L6) 默认返回 `false` → 整条 dossier v3 链（portraitSynthesizer / dossierPatcher / L2 重概念化）全部短路。

### 1.2 memory_layer_items 各层条数

| layer_name | rows | fams | 判定 |
|---|---|---|---|
| daily_updates | 1595 | 26 | ✅ 原话采集正常 |
| retrieval_indexes | 1389 | 8 | ⚠️ dead layer 但仍在写（8 家庭） |
| turn_events | 794 | 26 | ✅ 轮次记录正常 |
| pending_hypotheses | 657 | 23 | ✅ 假设积累正常 |
| interaction_cycles | 264 | 20 | ✅ 亲子链正常 |
| evidence_networks | 100 | 23 | ⚠️ 机制矩阵稀疏（平均 4 条/家庭） |
| entry_evidence_packs | 81 | 23 | ✅ 四模块采集正常 |
| deep_model_digest | 35 | 34 | ✅ digest 有产出 |
| daily_ui_snapshot | 28 | 28 | ✅ 画像快照有产出 |
| built_profile_snapshots | 19 | 19 | ⚠️ 只有 19 家庭建档完成 |
| deep_mechanism_handoffs | 19 | 19 | ⚠️ 疑似 dead write（仅审计脚本读） |
| raw_materials / cleaned_facts | 20 / 42 | 3 | ⚠️ dead layer 但仍在写 |

### 1.3 dossier 字段实测（34 家庭）

```sql
SELECT count(*) FILTER (WHERE data ? 'dossier' 
  AND (data->'dossier')::text <> 'null' 
  AND (data->'dossier')::text <> '{}') AS has_real_dossier,
  count(*) AS total
FROM memory_layer_items 
WHERE layer_name='deep_model_digest' AND item_id='latest';
-- 结果：has_real_dossier=0, total=34
```

**铁证**：34 个家庭，dossier 字段**全部为 null**。

### 1.4 Job 执行历史

| Job | succeeded | 判定 |
|---|---|---|
| deep_mechanism_review | 177 | ✅ 在跑，但 PORTRAIT_V3 关 → 全走 mechanismSynthesizer 旧路径，不产 dossier |
| digest_update | 1466 | ✅ 正常 |
| episode_ingest | 1369 | ✅ 正常 |
| memory_write | 1696 | ✅ 正常 |
| dossier_patch | 8 | ⚠️ flag 关 → 全是 `return false` 空操作 |

### 1.5 数据最多家庭的实际产出质量

家庭 `fam_1780644661390_km36wj`（541 条 daily_updates + turn_events）：

| 字段 | 实测 | 评价 |
|---|---|---|
| `mechanismNarrative` | 336 字 | ✅ 含原话"提醒两次""前10分钟不靠近"+ 因果链"母亲催促→孩子反抗→母亲焦虑升级"+ 功能分析"反抗保护自主权，催促缓解焦虑" |
| `anchoredFacts` | 6 条 | ✅ 有锚定事实 |
| `childQuotes` | 2 条 | ✅ 有孩子原话 |
| `structuralTensions` | 4 条 | ✅ 有结构张力 |
| `dossier` | null | ❌ 整合性画像空 |
| `evidence_networks.candidateMechanismMatrix` | **2 条** | ⚠️ 机制矩阵严重稀疏 |
| `daily_ui_snapshot.portraitCards.growth.summary` | "孩子底色是敏感、有主见的，但长期在催促和检查中学会了用拖延和撒谎保护自己。他不是懒…" | ✅ LLM 产出有质量 |
| `daily_ui_snapshot.source` | `llm` | ✅ 走了 LLM |

### 1.6 服务器实测结论

**AI 在工作，而且工作质量不差**——`mechanismNarrative` 336 字含原话+因果链+功能分析，`portraitCards` 是 LLM 产出的有质量内容。

**但 dossier v3 整合性画像从未生成**——`PORTRAIT_V3` 没开是第一病根。前台 AI 只能靠扁平碎片（dossierSlice string[] / matchedMechanisms 名字 / digest 字段）拼凑理解，**这就是你说的"瞎猜、没整体思维"的技术根因**。

---

## Part 2 · 三链审计结论

### 2.1 产出链（dossier 能否从原话形成）

**结论：能，但条件未满足。**

完整 call graph（[pipeline.ts:332-747](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L332-L747)）：

```
家长原话 → turn_events → getMergedParentInputHistory(100) 
  → ecosystemClassifier → theoryMatcher → portraitSynthesizer 
  → saveDossierVersion（dossier_v{n} + latest）
```

**产出链 5 个断点**：

1. **PORTRAIT_V3 默认关**（[portrait-v3-flags.ts:3-6](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/portrait-v3-flags.ts#L3-L6)）→ 整链不跑
2. **totalFacts<3 早期退出**（[pipeline.ts:358](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L358)）→ 新家庭前几轮不产
3. **portraitSynthesizer 失败回退**（[pipeline.ts:533-535](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L533-L535)）→ 回退 mechanismSynthesizer 不产 dossier
4. **落库门控只看 workingHypothesis.text**（[pipeline.ts:536](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L536)）→ 不检查 predictions / sceneReadings 结构完整性
5. **predictions 可能空** → L2 链路失效，dossier 卡 v1 不演进

**产出链的浅点**：

| 浅点 | 影响 |
|---|---|
| flatFacts slice(0, 80) | 早期证据被截断，ecosystemMap + theoryMatches 都基于这 80 条 |
| existingMechanisms description slice(0,180) | L2 看不到旧机制完整因果链 |
| dailyUpdates 单条 slice(0,200) | 长家长原话被截断 |
| **exo/macro 层无 rich 卡**（7 张 legacy 简版） | 家庭问题在升学文化/社会期待层时理论透镜失效 |
| evidenceSummary 8 标签映射"待验证" | SP 硬编码标签未经代码侧校验 |

**心理学视角**：dossier 的设计是对的——它要求"整合性理解"而非"机制卡片堆叠"，这符合 **家庭系统理论（Bowen）** 的核心：家庭成员的行为只有放在家庭互动模式的整体中才能被理解。但当前实现把 dossier 关在 flag 后面，等于建好了整合框架却不用。

### 2.2 更新链（dossier 能否随新原话更新）

**结论：代码完整，但 4 个断点让它实际上不更新。**

两条更新路径：

**路径 1（轻量 patch）**：memory_write → dossier_patch → dossierPatcher SP
- 触发：非 counter_evidence + newFacts 非空（[queue.ts:161-173](file:///Users/mac/Desktop/育见-2/src/lib/server/jobs/queue.ts#L161-L173)）
- 但 `PORTRAIT_V3` 关 → `dossier-patcher.ts:22` 直接 `return false`

**路径 2（L2 重概念化）**：shouldReconceptualize → portraitSynthesizer → saveDossierVersion
- 5 个触发入口：episode_ingest / login / 10 turns / build / prediction_failed
- 但 `PORTRAIT_V3` 关 → `pipeline.ts:516` `usePortrait=false` → 走旧 mechanismSynthesizer 不产 dossier

**更新链 4 个断点**：

1. **PORTRAIT_V3 默认关**（第一断点，同产出链）
2. **counter_evidence 不触发 L2**——memory_write 日桶不再链式 deep_mechanism_review（[queue.ts:160](file:///Users/mac/Desktop/育见-2/src/lib/server/jobs/queue.ts#L160)），counter_evidence 轮又跳过 dossier_patch（[queue.ts:161-164](file:///Users/mac/Desktop/育见-2/src/lib/server/jobs/queue.ts#L161-L164)）。若未满 10 轮/未登录/未 episode_ingest，counter_evidence 写入后 dossier 永不更新
3. **prediction_failed 永不触发的可能**——predictions 由 portraitSynthesizer 生成，L1 patch 禁改 predictions。若 SP 产出空 predictions，`getFailedPredictions` 返回空，prediction_failed 永不触发
4. **dossier 无 freshness 检查**——`getLatestDossier` 不对比 updatedAt，dossier 可能 stale 数小时/数天，前台 SP 仍按旧 dossier 回复

**dossier stale 高风险场景**：

| 场景 | stale 时长 | 根因 |
|---|---|---|
| 用户每天聊 <10 轮 | 无限 | buffer 不满 10 不 flush |
| counter_evidence 写入但未触发 L2 入口 | 无限 | 跳过 patch + 日桶不链 L2 |
| portraitSynthesizer 产空 predictions | 永不触发 L2 | 门控不检查 predictions |
| Job 5 次失败进 failed | 直到下次登录 | 需 forceLoginJobCheck 重投 |
| 用户长期不登录 | 无限 | 无 TTL，前台不检查 freshness |

**心理学视角**：dossier 的更新机制设计是对的——predictions 作为"可证伪假设"，counter_evidence 作为"反证"，这符合 **Popper 科学哲学** 的可证伪原则。但当前 counter_evidence 进不了 dossier、predictions 可能空导致 L2 永不触发，等于科学方法的"假设-验证-修正"闭环断了。

### 2.3 消费链（前台 AI 能否最大化利用 dossier）

**结论：dossier 即使生成了，前台也读不充分。**

3 个断点：

1. **dossierSlice 扁平化丢失结构化信息**——[dossier-slicer.ts:119-131](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/dossier-slicer.ts#L119-L131) 把 9 个结构化字段压成 string[]，丢失 predictions.status / interventionTargets.prediction / alternativeReadings.confidence
2. **hidden section 丢 retrievalPack**——[parent-facing-copy.ts:107-114](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts#L107-L114) dossierSlice 非空时只保留 dossierSlice + deepModelDigest，丢失 entryFacts/childQuotes/原话
3. **SP 之间 dossier 信息量差异巨大**——只有 `dailyPortraitRefresh` 按 v3 五段读 dossier 对象；`dailyDialogueOrchestration` / `communicationRehearsal` 只读扁平 dossierSlice

**悖论**：dossier 越厚（dossierSlice 非空），hidden section 读到的原始事实越少；dossier 空时反而走 buildDailyProsePayload 拿到完整 retrievalPack。这形成"dossier 成熟度越高，hidden section 失去原始事实锚点"的反直觉现象。

**心理学视角**：前台 SP 读 dossier 的颗粒度差异，对应 **认知心理学** 的"专家 vs 新手"差异。画像页 SP 像"专家"——能读 dossier 的结构化关系（predictions 的 status 区分假设是否被反证）；交流/预演 SP 像"新手"——只能读扁平标签。要让所有 SP 都"像专家"，需要统一 dossier 读包颗粒度。

---

## Part 3 · 改进方案（结合心理学 + 教育学 + 链路精简）

### Layer 1 · 小改（1-2 天，立刻能做）

#### L1-1 · 开启 `PORTRAIT_V3=1`（P0 · 立刻）

**动作**：在生产 `/home/ubuntu/apps/yujian/.env.local` 加一行 `PORTRAIT_V3=1`，重启 PM2。

**预期效果**：
- portraitSynthesizer 开始跑，dossier 开始生成
- dossierPatcher 开始工作，dossier 能随新原话 patch
- L2 重概念化链路激活

**心理学依据**：dossier v3 的设计本质是 **家庭系统理论 + 临床个案概念化（Clinical Formulation）**——把离散事实整合成"这个家庭为什么这样运转"的连贯叙事。当前关着 flag 等于建好了临床框架却不用，必须先打开。

**风险**：portraitSynthesizer 是 12288 token 的大 LLM 调用，开启后成本上升。建议先在 1-2 个测试家庭验证质量，再全量。

#### L1-2 · 修复 hidden section 丢 retrievalPack（P0）

**文件**：[parent-facing-copy.ts:107-114](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts#L107-L114)

**动作**：dossierSlice 非空时，payload 不再只保留 dossierSlice + deepModelDigest，而是保留 dossierSlice + **retrievalPack 的关键子集**（entryFacts 前 5 条 + childQuotes 前 3 条 + parentVerbatimSnippets 前 3 条）+ deepModelDigest。

**心理学依据**：hidden section 是"深度展开"——需要既有 dossier 的整合判断，又有原始事实锚点。这对应 **动机性访谈（Motivational Interviewing）** 的"具体性"原则：家长需要听到"你记得我家说过 X"才能感到被理解，光有整合判断不够。

#### L1-3 · 修复预演 handoff 空（P0）

**文件**：[daily/index.tsx](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/daily/index.tsx) + [rehearsal/index.tsx:50-56](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L50-L56)

**动作**：在 daily/index.tsx 跳预演的入口补 `setStorageSync(REHEARSAL_HANDOFF_KEY, { sceneId, seedText, parentText, rehearsalGoal, traceId, retrievalPackDigest })`，其中 `retrievalPackDigest` 是最近一轮的 entryFacts 前 3 条 + matchedMechanisms 前 2 条。

**心理学依据**：预演是"行为演练"——需要基于该孩子的真实场景原话，而非通用话术。这对应 **认知行为疗法（CBT）** 的"情境特异性"原则：干预要锚定具体情境，不能泛泛而谈。

#### L1-4 · 修复预演 end 步骤 hardcode（P0）

**文件**：[rehearsal/index.tsx:770-819](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L770-L819)

**动作**：end 步骤的 statusText / openingHint / openingChild / confirmBullets / closingAdvice / childLikelyHearing / saferVersion 全部接 `endData` 后端字段，不取 hardcode fallback。endData.likelyTriggeredMechanisms 不只取前 3 条 join，而是完整渲染。

**心理学依据**：预演的"孩子反应模拟"必须基于该孩子的真实防御模式（dossier.workingHypothesis），而非"孩子有点烦，防御比较高"这种通用描述。这对应 **依恋理论（Attachment Theory）** 的个体差异原则：每个孩子的依恋模式不同，防御方式不同。

#### L1-5 · 修复建档结果页 Hero hardcode（P0）

**文件**：[packageOnboarding/pages/result/index.tsx:132-145](file:///Users/mac/Desktop/育见-2/miniprogram/src/packageOnboarding/pages/result/index.tsx#L132-L145)

**动作**：Hero 的 kicker/title/copy 改为读 `snapshot.coreJudgment` 摘要 + `portraitCards.growth.summary` 首句。例如：
- kicker: `画像已生成 v1`（读 dossier.version）
- title: `coreJudgment` 前 30 字
- copy: `portraitCards.growth.summary` 前 60 字

**心理学依据**：建档刚完成的时刻是家长的"期待高峰"——此时展示与刚填内容相关的个性化反馈，能建立信任。这对应 **人本主义心理学（Rogers）** 的"无条件积极关注"原则：让家长感到"你真的看了我说的"。

---

### Layer 2 · 中改（1-2 周，让 AI 有整体思维）

#### L2-1 · dossierSlice 保留结构化信息（P1 · 核心）

**问题**：当前 `flattenDossierSlice`（[dossier-slicer.ts:119-131](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/dossier-slicer.ts#L119-L131)）把 dossier 压成 string[]，丢失 predictions.status / interventionTargets.prediction / alternativeReadings.confidence。

**方案**：改造 `FrontendReadSchema`，`dossierSlice` 字段从 `string[]` 改为 `DossierSliceStructured[]`（保留 9 个结构化字段）。但这会破坏 prompt cache 契约，需评估。

**折中方案**：保持 `dossierSlice: string[]`，但每条 string 用 **带语义标签的 JSON 片段**，例如：
```
"workingHypothesis:孩子用拖延保护自主权|predictions:pred_1:减少催促后孩子反应改善(unverified)"
```
SP 能从字符串里解析出结构。

**心理学依据**：这对应 **个案概念化（Case Conceptualization）** 的结构化要求——治疗师脑子里有"假设-证据-反证"的网络，不是扁平的标签。前台 AI 也需要看到这个网络，才能做精准回复。

#### L2-2 · 所有前台 SP 按 dossier v3 五段拆分（P1）

**文件**：
- [dailyDialogueOrchestration.md:16](file:///Users/mac/Desktop/育见-2/prompts/front/dailyDialogueOrchestration.md#L16)（只提 dossierSlice）
- [communicationRehearsal.md:22](file:///Users/mac/Desktop/育见-2/prompts/front/communicationRehearsal.md#L22)（只提 dossierSlice）

**动作**：参考 [dailyPortraitRefresh.md:119-127](file:///Users/mac/Desktop/育见-2/prompts/front/dailyPortraitRefresh.md#L119-L127) 的五段拆分，在 dailyDialogueOrchestration 和 communicationRehearsal 里也铺开 dossier v3 五段（integratedSynthesis / workingHypothesis / sceneReadings / interventionTargets / familyStruct）的取用说明。

**心理学依据**：交流页是"即时回应"——需要 dossier 的 workingHypothesis（当前主判断）+ predictions（哪些假设在测）；预演页是"行为演练"——需要 dossier 的 interventionTargets（可试方向）+ sceneReadings（场景解读）。不同场景读 dossier 不同段，但都要读全。

#### L2-3 · 修复更新链 4 个断点（P1）

**断点 1 · counter_evidence 不触发 L2**

文件：[queue.ts:161-164](file:///Users/mac/Desktop/育见-2/src/lib/server/jobs/queue.ts#L161-L164)

动作：counter_evidence 轮跳过 dossier_patch 后，**强制入队 deep_mechanism_review**（forceFull=true, reason='counter_evidence'）。因为 counter_evidence 是对现有假设的直接反证，必须触发 L2 重概念化。

**心理学依据**：counter_evidence 是 **科学方法的反证** ——当证据与假设冲突时，必须修正假设。当前跳过 patch 是对的（不能让反证轮直接改 dossier），但不触发 L2 就是"反证被忽略了"。

**断点 2 · predictions 必产硬约束**

文件：[pipeline.ts:536](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L536) + [portraitSynthesizer.md:83](file:///Users/mac/Desktop/育见-2/prompts/background/portraitSynthesizer.md#L83)

动作：
- 落库门控增加 `predictions.length >= 1` 检查（除了 workingHypothesis.text 非空）
- portraitSynthesizer SP 把"predictions 必产"从"产量诚实"降级项改为硬约束

**心理学依据**：predictions 是"可证伪假设"——没有假设就没有科学方法。dossier 没有 predictions 等于临床判断没有可验证性，永远无法被修正。

**断点 3 · dossier freshness 检查**

文件：[digest-store.ts:26-29](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/digest-store.ts#L26-L29)

动作：`getLatestDossier` 增加 `updatedAt` 与当前时间比对，超阈值（如 24h）返回 `{ dossier, stale: true }`。前台 SP 读到 stale 标记时，可在回复里加"我对你们家的理解可能需要更新，最近几次交流我还在整理"。

**心理学依据**：这对应 **治疗联盟（Therapeutic Alliance）** 的诚实原则——治疗师不会假装"我很了解你"，而是诚实"我还在理解中"。家长对 AI 的信任建立在诚实上，而非假装全知。

**断点 4 · intervention_failed 阈值调优**

文件：[should-reconceptualize.ts:70](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/should-reconceptualize.ts#L70)

动作：阈值从"≥3 次同主题"调到"≥2 次同主题 或 1 次但有 dossier.fivePs.protective[0] 直接关联"。clusterTurnEventsByTheme 的聚类维度从 matchedMechanisms[0] 扩展到含 dossier.fivePs.protective[0].id。

**心理学依据**：任务失败 2 次就该反思干预方向了——这对应 **循证实践（Evidence-Based Practice）** 的"失败即修正"原则。等 3 次太晚，家长可能已经放弃。

#### L2-4 · 精简链路冗余（P1 · 清理）

| 冗余 | 处理 |
|---|---|
| `raw_materials` / `cleaned_facts` / `retrieval_indexes` dead layer | 彻底删写入代码（当前虽有开关但 8 家庭仍在写 retrieval_indexes） |
| `dossierProjection` 不持久化 | 保持现状（每次重新构造成本低，不值得持久化） |
| `pickDeepModelDigestPack` 双重优先 dossier.integratedSynthesis | 保留（有意为之，保证前台读到 dossier 权威版本） |
| `deep_mechanism_handoffs` 疑似 dead write | 审计是否有 reader，若无则降级为纯审计层 |
| `saveEnrichedHandbookCandidate` 疑似 dead write | 审计 handbook 候选消费链，若无 reader 则删 |
| `fillDailySectionCopy` 的 taskTitle 孤儿字段 | 接线到 daily-turn-bff 或删 |
| THEORY_CARDS 注释"15×9" | 改为实际"20 张（10 rich × 7 fields + 3 partial + 7 legacy）" |

---

### Layer 3 · 大改（1-2 月，记忆有效性与利用率最大化）

#### L3-1 · 补齐 THEORY_CARDS exo/macro 层 rich 卡（P2 · 核心）

**问题**：[theory-cards.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/theory-cards.ts) 7 张 legacy 简版卡全在 exo/macro 层（升学文化压力、社会期待、隔代照料），导致家庭问题在这些层时理论透镜失效。服务器实测"数据最多家庭只有 2 条机制"可能就是这个原因。

**动作**：补齐 7 张 legacy 卡的 rich 字段（coreViewpoint / judgmentDimensions / confidenceRules / recommendedInterventions / tabooAdvice / parentFacingExpression / outputConstraints）。

**心理学依据**：exo/macro 层对应 **Bronfenbrenner 生态系统理论** 的外层/宏系统——家庭不是孤立的，升学文化、社会期待、隔代照料这些宏观因素深刻影响家庭互动。当前这些层"无刀可用"，导致 portraitSynthesizer 对宏观因素的判断能力弱。

#### L3-2 · dossier 质量评分机制（P2）

**问题**：当前 dossier 落库门控只看 `workingHypothesis.text` 非空，不检查结构完整性。可能产出"有 text 但其他字段稀疏"的空壳 dossier。

**动作**：引入 dossier 质量评分：
- `completeness`：7 段（familyStruct/fivePs/sceneReadings/parentPerspectives/workingHypothesis/interventionTargets/integratedSynthesis）非空比例
- `evidenceDensity`：evidenceLedger 条数 / flatFacts 条数
- `predictionCoverage`：predictions 条数 / interventionTargets 条数
- `freshness`：updatedAt 与当前时间差

分数低时前台 SP 降级到"还在了解"诚实表态，不强行用空壳 dossier。

**心理学依据**：这对应 **临床评估** 的"信度/效度"原则——判断的质量要可量化，不能只看"有没有产出"。

#### L3-3 · dossier freshness 感知的前台降级（P2）

**动作**：前台 SP 读 dossier 时，若 `stale=true` 或 `completeness<0.5`，自动降级：
- 交流页：prose 加"我最近还在整理对你家的理解"
- 画像页：portraitCards 对应卡显示"还在了解"
- 预演页：方案加"基于目前有限的理解，建议先试..."

**心理学依据**：这对应 **治疗诚实（Therapeutic Honesty）** ——AI 不假装全知，家长反而更信任。

#### L3-4 · 重构记忆架构为"dossier 为中心"（P2 · 长期）

**当前架构**：dossier 是 deep_mechanism_review 的副产品，digest 是 dossier 的投影，dossierSlice 是 digest 的切片。多层投影导致信息丢失。

**目标架构**：dossier 作为**唯一真源**，digest / dossierSlice / dossierProjection 都从 dossier 实时派生（而非持久化投影）。但这需要大改，建议在 Layer 1-2 验证 dossier v3 有效后再推进。

---

## Part 4 · 链路精简清理总图

### 当前链路（冗余视图）

```
家长原话
  ├─→ turn_events（每轮）
  ├─→ daily_updates（memory_write）
  ├─→ entry_evidence_packs（建档）
  ├─→ episodes/atoms（episode_ingest）← 向量化
  ├─→ raw_materials ← dead layer（8 家庭仍在写）
  ├─→ cleaned_facts ← dead layer
  └─→ retrieval_indexes ← dead layer

deep_mechanism_review（5 路触发）
  ├─→ ecosystemClassifier → ecosystemMap
  ├─→ theoryMatcher → theoryMatches
  ├─→ portraitSynthesizer → dossier（PORTRAIT_V3 关时不产）
  ├─→ mechanismSynthesizer → candidateMechanismMatrix（兜底）
  ├─→ structuralRiskExtractor → structuralTensions
  └─→ saveEvidenceNetwork / savePendingHypotheses / saveFamilyInteractionCycles / saveParentNarrativePattern / saveBuiltProfileSnapshot

dossier 更新
  ├─→ dossier_patch（L1 轻量 patch，PORTRAIT_V3 关时 return false）
  └─→ L2 重概念化（shouldReconceptualize 6 条件，PORTRAIT_V3 关时不跑）

dossier 消费
  ├─→ dossierSlice（flatten 成 string[]，丢结构化信息）
  ├─→ dossierProjection（不持久化，LLM payload 中间结构）
  ├─→ deepModelDigest.mechanismNarrative（优先 dossier.integratedSynthesis）
  └─→ dailyPortraitRefresh 直接读 dossier 对象（唯一按 v3 五段读的 SP）

前台 SP
  ├─→ dailyDialogueOrchestration（只读 dossierSlice 扁平）
  ├─→ dailyPortraitRefresh（读 dossier v3 五段）
  ├─→ communicationRehearsal（只读 dossierSlice 扁平）
  └─→ enrich（间接依赖 dossier，经 digest 两层降级）

dead write 嫌疑
  ├─→ deep_mechanism_handoffs（仅审计脚本读）
  ├─→ saveEnrichedHandbookCandidate（无 reader）
  └─→ fillDailySectionCopy.taskTitle（孤儿字段）
```

### 精简后目标链路

```
家长原话
  ├─→ turn_events（每轮）
  ├─→ daily_updates（memory_write）
  ├─→ entry_evidence_packs（建档）
  └─→ episodes/atoms（episode_ingest）← 向量化
  （删 raw_materials / cleaned_facts / retrieval_indexes 写入）

deep_mechanism_review（5 路触发 + counter_evidence 强制 L2）
  ├─→ ecosystemClassifier → ecosystemMap
  ├─→ theoryMatcher → theoryMatches（补齐 exo/macro rich 卡）
  ├─→ portraitSynthesizer → dossier（PORTRAIT_V3=1 必产 predictions）
  ├─→ structuralRiskExtractor → structuralTensions
  └─→ saveEvidenceNetwork / savePendingHypotheses / saveFamilyInteractionCycles / saveParentNarrativePattern / saveBuiltProfileSnapshot

dossier 更新
  ├─→ dossier_patch（L1 轻量 patch，非 counter_evidence）
  └─→ L2 重概念化（6 条件 + counter_evidence 强制 + prediction_failed 硬触发）

dossier 消费
  ├─→ dossierSlice（保留结构化标签，SP 可解析）
  ├─→ dossierProjection（保持不持久化）
  ├─→ deepModelDigest.mechanismNarrative（优先 dossier.integratedSynthesis）
  └─→ 所有前台 SP 按 v3 五段读 dossier

前台 SP（统一 dossier 读包颗粒度）
  ├─→ dailyDialogueOrchestration（读 dossier v3 五段）
  ├─→ dailyPortraitRefresh（读 dossier v3 五段 + predictions）
  ├─→ communicationRehearsal（读 dossier v3 五段 + interventionTargets）
  └─→ enrich（respect preferLlm，tensions 卡翻译不照抄）

清理
  ├─→ 删 dead layer 写入代码
  ├─→ 审计 deep_mechanism_handoffs / saveEnrichedHandbookCandidate reader
  ├─→ 接线或删 fillDailySectionCopy.taskTitle
  └─→ 修正 THEORY_CARDS 注释

dossier 质量保障
  ├─→ 落库门控检查 predictions.length >= 1
  ├─→ dossier 质量评分（completeness / evidenceDensity / predictionCoverage / freshness）
  └─→ freshness 感知前台降级
```

---

## Part 5 · 预期效果与验收

### Layer 1 后的预期效果

- `PORTRAIT_V3=1` → portraitSynthesizer 开始跑，dossier 开始生成
- 新家庭建档后 + 10 轮交流后，dossier 应有 v1（含 workingHypothesis + predictions）
- hidden section 含 retrievalPack 关键子集，不再丢原话锚点
- 预演 handoff 带记忆摘要，end 步骤接 endData 字段
- 建档结果页 Hero 读 snapshot

**验收命令**：
```bash
# 服务器查 dossier 是否开始生成
psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE data ? 'dossier' AND (data->'dossier')::text <> 'null') AS has_dossier, count(*) AS total FROM memory_layer_items WHERE layer_name='deep_model_digest' AND item_id='latest';"
# 期望：has_dossier > 0
```

### Layer 2 后的预期效果

- 所有前台 SP 按 dossier v3 五段读 dossier
- dossierSlice 保留结构化信息（SP 能看到 predictions.status）
- counter_evidence 触发 L2，dossier 能随反证更新
- predictions 必产，L2 链路可演进
- dossier freshness 检查，stale 时前台诚实降级

**验收命令**：
```bash
# 查 dossier.predictions 是否非空
psql "$DATABASE_URL" -c "SELECT family_id, jsonb_array_length(data->'dossier'->'workingHypothesis'->'predictions') AS pred_n FROM memory_layer_items WHERE layer_name='deep_model_digest' AND item_id='latest' AND data ? 'dossier' LIMIT 5;"
# 期望：pred_n >= 1
```

### Layer 3 后的预期效果

- THEORY_CARDS exo/macro 层补齐，机制矩阵不再稀疏（目标平均 ≥5 条/家庭）
- dossier 质量评分，空壳 dossier 不上屏
- 前台 SP dossier freshness 感知降级
- 链路精简，dead write 清理

**验收命令**：
```bash
# 查机制矩阵密度
psql "$DATABASE_URL" -c "SELECT family_id, jsonb_array_length(data->'candidateMechanismMatrix') AS mech_n FROM memory_layer_items WHERE layer_name='evidence_networks' LIMIT 10;"
# 期望：mech_n 平均 >= 5

# 查 dossier 质量评分
psql "$DATABASE_URL" -c "SELECT family_id, data->'dossier'->>'version' AS ver, jsonb_array_length(data->'dossier'->'workingHypothesis'->'predictions') AS pred_n FROM memory_layer_items WHERE layer_name='deep_model_digest' AND item_id='latest' AND data ? 'dossier' LIMIT 10;"
# 期望：所有家庭 pred_n >= 1
```

---

## Part 6 · 最终结论

### 你的核心痛点的技术根因

> "AI 对于家长可能输入什么，我怎么做整理这一步都是在瞎猜的"

**根因**：`PORTRAIT_V3` 没开 → dossier v3 整合性画像从未生成 → 前台 AI 只能靠扁平碎片（dossierSlice string[] / matchedMechanisms 名字 / digest 字段）拼凑理解 → "瞎猜"。

**这不是 AI 能力问题，是配置问题**。AI 在 mechanismNarrative / portraitCards 上已经证明它能产出有质量的内容（336 字含原话+因果链），只是 dossier 整合框架被关在 flag 后面。

> "它没有整体思维，也没有一个对用户的精准把握"

**根因**：即使 dossier 生成了，前台 SP 之间读 dossier 颗粒度差异巨大——画像页 SP 按 v3 五段读，交流/预演 SP 只读扁平 dossierSlice。这是"分块拼接"而非"整体理解"。

**修复**：Layer 2 的 L2-1（dossierSlice 保留结构化）+ L2-2（所有 SP 按 v3 五段拆分）。

### 推荐执行顺序

1. **立刻**：L1-1（开 `PORTRAIT_V3=1`）+ 验证 dossier 开始生成
2. **1-2 天**：L1-2 ~ L1-5（修 5 个 P0 断点）
3. **1-2 周**：L2-1 ~ L2-4（让 AI 有整体思维 + 精简链路）
4. **1-2 月**：L3-1 ~ L3-4（补齐理论卡 + 质量评分 + 架构优化）

### 给 Cursor 的实施指令

Layer 1 的 5 个 P0 断点都是**小而具体**的改动，适合交给 Cursor。建议按以下顺序：
1. L1-1（改 .env.local，1 行）
2. L1-2（parent-facing-copy.ts hidden payload，~10 行）
3. L1-3（daily/index.tsx handoff 写入，~15 行）
4. L1-4（rehearsal/index.tsx end 步骤接 endData，~50 行）
5. L1-5（result/index.tsx Hero 读 snapshot，~20 行）

Layer 2 涉及 SP 改写和 schema 改造，建议 Trae 负责（上下文长优势）。

Layer 3 涉及理论卡补齐和架构优化，需要心理学/教育学专家介入，建议作为长期演进项。

---

## 附录 · 服务器实测原始数据

（见 Part 1.1-1.6，此处不重复）

## 附录 · 关键文件索引

| 文件 | 作用 |
|---|---|
| [portrait-v3-flags.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/portrait-v3-flags.ts) | PORTRAIT_V3 feature flag |
| [pipeline.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts) | deep_mechanism_review 主链 |
| [should-reconceptualize.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/should-reconceptualize.ts) | L2 触发判定 |
| [dossier-patcher.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/dossier-patcher.ts) | L1 patch |
| [dossier-slicer.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/dossier/dossier-slicer.ts) | dossierSlice 扁平化 |
| [parent-facing-copy.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts) | hidden section payload |
| [frontend-read-pack.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/frontend-read-pack.ts) | FrontendReadSchema 11 键 |
| [portraitSynthesizer.md](file:///Users/mac/Desktop/育见-2/prompts/background/portraitSynthesizer.md) | dossier 产出 SP |
| [theory-cards.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/theory-cards.ts) | 20 张理论卡 |
| [digest-store.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/digest-store.ts) | dossier 落库 |
