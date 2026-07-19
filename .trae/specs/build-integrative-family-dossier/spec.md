# 整合性家庭理解底稿（Family Understanding Dossier）Spec · 优化版

> 本版基于全链路探测（36 Agent / 10 Job / 前台3处LLM调用 / matchedMechanisms双slice链路）+ 用户反馈（减冗余/去概念/去待观察/不依赖孩子原话/不大修现有链路）优化。核心策略：**复用现有 deep_mechanism_review Job 与 memory_write 链，不新建 Job 不新建表**。

## Why

当前"深度画像"是 `candidateMechanismMatrix`（10–20 张离散机制卡）→ `formatMatchedMechanisms` 拼成"名+描述+依据+保护"→ digest 取 `topMechanism.description` 单段 → 前台贴卡。问题：

1. **单薄**：一段 `mechanismNarrative` 概括不了一个家庭。
2. **前端无米下锅**：retrievalPack 只给 `matchedMechanisms` 字符串数组，前台只能贴卡。
3. **无更新机制**：`saveEvidenceNetwork`/`saveBuiltProfileSnapshot`/`saveDeepModelDigest` 全是整体覆盖（upsert/replace，见 [database-manager.ts:191/222](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/database-manager.ts) + [digest-store.ts:20](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/digest-store.ts)），新反馈无法增量更新画像、反证无法降权。
4. **理论外露**：`theoryCardId`/`mechanismName` 必填，违反理论报告"理论隐身/输出约束"。

## What Changes（优化版：复用现有链路，不大修）

- **复用 `deep_mechanism_review` Job**：在其内部把 `mechanismSynthesizer` 步骤（[pipeline.ts:484](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts)）替换为 `portraitSynthesizer`（新 SP `prompts/background/portraitSynthesizer.md`）。**不新建 Job**，不新开触发源。
- **复用 `deep_model_digest` 存储层**：把 digest schema 从单字段 `mechanismNarrative` 扩展为 dossier 多段落（schema v2，[digest-store.ts:20](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/digest-store.ts) 加 `schemaVersion` 字段 + 历史版本追加 `item_id=dossier_v{n}`）。**不新建表**。
- **复用 `memory_write` 链做 Level 1 增量**：在 `executeWritePlan`（[decision-engine.ts:200](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/write/decision-engine.ts)）尾部，非反证轮链式触发 `dossier_patch`（轻量 Job，仅改受影响段落）。**不新开触发源**，挂在现有 memory_write 之后。
- **Level 2 重概念化复用现有触发**：`shouldReconceptualize` 判定并入 `deep_mechanism_review` Job 入口（[pipeline.ts:316](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts)），反证≥2/干预无效/指纹变化时强制全量重跑。现有 4 路触发键（日桶/episode/10轮/build）不变。
- **重构 `theory-cards.ts`**：按理论报告 15 张 × 9 rich fields 重建（保持卡名不重命名）。**BREAKING**（内部 schema）。
- **digest 投影改造**：`buildDeepModelDigest`（[digest-builder.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/digest-builder.ts)）从取 `topMechanism.description` → 投影 dossier 多段。
- **前台厚包加 `dossierSlice`**：`pickFrontendReadPack`（[frontend-read-pack.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/frontend-read-pack.ts)）新增字段，按本轮 query 切段落。`matchedMechanisms` 降级兜底，双 slice 统一为 8。
- **前台 SP 改引用**：`parentFacingStyle` §三、`dailyDialogueOrchestration` §1 改引 `dossierSlice`。
- **宪法修订**：`docs/product/deep-modeling.md` §2/§7。
- **Phase B 低风险先行**：100 条输入窗口、THEORY_CARDS 进 system cache、deep job 触发去重。

## Impact

- **Affected specs**：`docs/product/deep-modeling.md`、`docs/contracts/read-contract.md`
- **Affected code**：
  - 改：`deep-mechanism/pipeline.ts`（synthesizer 步骤替换 + shouldReconceptualize 入口判定）、`theory-cards.ts`、`deep-modeling/digest-builder.ts`+`llm-digest-builder.ts`+`pick-deep-model-digest.ts`、`daily/frontend-read-pack.ts`+`memory/retrieval/router.ts`、`daily/prose-context.ts`、`write/decision-engine.ts`（尾部链 dossier_patch）、`jobs/queue.ts`（加 dossier_patch Job 类型）
  - 新：`src/lib/server/memory/dossier/dossier-slicer.ts`、`prompts/background/portraitSynthesizer.md`、`prompts/background/dossierPatcher.md`
- **契约不变**：`packages/contracts` 的 `DailyStreamEvent`/`DailySection`/`DailyAction` 不动，小程序零改。

---

## ADDED Requirements

### Requirement: Family Understanding Dossier 结构（优化版：减冗余、去概念、去待观察、不依赖孩子原话）

系统 SHALL 在 `deep_model_digest` 存储层维护一份 `FamilyUnderstandingDossier`（schema v2），作为对一个家庭的整合性理解主存储。

#### 减冗余决策（对应用户反馈）

- **砍 `evidencePointers` 显式 ev_xxx ID**：前端拿不到、家长无感、占字段。改为每因素带 `evidenceSummary`（人话一句 + 来源模块标签如「作业模块」「妈妈原话」）。LLM 内部仍可引证据，但存储只存人话摘要。
- **砍 `crossSceneFrequency` 独立字段**：并入 `confidence` 的简短备注（如 `0.72 (3/4场景现)`），不单列。
- **砍 `openObservations` 段**：有疑问就进 `alternativeReadings` 的"区分证据"——不单开"待观察点"段，避免家长看到一堆【待观察】无意义列表。
- **砍 `childQuotes` 依赖**：digest 不再从 highValueAtoms 的 `child_quote` 拼原话段。孩子原话作为 `evidenceSummary` 的来源之一即可，不单列。
- **去概念词**：`workingHypothesis`/`integratedSynthesis` 不许出现"稳态""强制循环""homeostasis""三角化""SDT"等术语，用人话。理论只在 `ecologicalCalibration`（内部段，不进 dossierSlice）出现。
- **砍 `predictedObstacles` 独立段**：并入 `interventionTargets` 每条的 `obstacle` 字段，不单列段。

#### 形态决策（Option B：显式段落 + 权重 + 强整合）

经评估选定 Option B（理由见 v3 探索文档）：段落提供前台可寻址结构；`workingHypothesis` 把所有因素按 ID 串成可证伪一体陈述；`integratedSynthesis` 唯一散文段串整体。"没有边界连贯一体"由强整合 + 因素 ID 交叉引用实现。

**整合硬约束**：
- 每个 `perpetuating` 因素 MUST 被 ≥1 个 `interventionTarget.targets` 引用
- `workingHypothesis` MUST 引用 ≥2 个 `perpetuating` ID + ≥2 个 `protective` ID + 全部 `prediction`
- `integratedSynthesis` 引用的判断 MUST 能在 `fivePs`/`familyStruct` 找到对应 ID 条目
- `sceneReadings` 每场景 `protective` 配比 MUST 引用 `protective[]` 已定义 ID

#### 底稿段落（优化后 7 段，从 10 段精简）

1. **familyStruct（家庭结构）**：亚系统/边界/层级/联盟，每项带 `confidence` + `evidenceSummary`（人话+来源模块）。**前台 profile 主渲染源**。
2. **fivePs（5Ps 因素）**：
   - `presenting`（主诉，一句话）
   - `predisposing[]`（易感）/`precipitating[]`（诱发）/`perpetuating[]`（维持，带 `id` 供 interventionTarget 引用）/`protective[]`（保护，带 `id` + 跨场景配比）
   - 每因素：`{id, label(人话), confidence(0-1含备注), evidenceSummary}`
3. **sceneReadings（分场景配比）**：≥3 场景，每场景 `protective` 配比（引用 protective[].id）+ 主 `perpetuating` id + 一句人话 reading。
4. **parentPerspectives（家长各自）**：每位养育者 `{intent, childReception, actualImpact, blindSpot, receptivity(0-1)}`。
5. **workingHypothesis（工作假设，可证伪）**：一段人话陈述（无术语）+ `predictions[]`（≥2 条可证伪，每条失败触发重概念化）。
6. **interventionTargets（干预靶点）**：每条 `{id, targets(perpetuating id), action(人话), prediction(引用), obstacle(并入此)}`。
7. **ecologicalCalibration（内部，不进 dossierSlice）**：活跃生态层 + 理论透镜自检清单。
8. **integratedSynthesis（整体理解，唯一散文段，200-400字）**：把上述串成"读完认识这个家庭"，无术语。
9. **alternativeReadings（竞争解读）**：≥2 条，每条 `{label, confidence, distinguishingEvidence(区分所需)}`。证据不足多解并存。

底稿 SHALL NOT 含：`theoryCardId`、`mechanismName`、`overallStrength`、`【待验证】`/`【下一步看】`、`evidencePointers`(ev_xxx)、`crossSceneFrequency`、`openObservations`、`childQuotes` 段、`predictedObstacles` 段、无 evidenceSummary 的模糊判断。

#### Scenario: 精确与可测试（优化版）
- **WHEN** portraitSynthesizer 产出底稿
- **THEN** 每个 perpetuating/protective 因素带 confidence(0-1含跨场景备注) + evidenceSummary(人话+来源模块)
- **AND** workingHypothesis 含 ≥2 条可证伪 predictions，无术语
- **AND** 每个 interventionTarget 引用 perpetuating id + prediction + obstacle（obstacle 并入此不单列）
- **AND** integratedSynthesis 无术语，引用判断可追溯到 fivePs/familyStruct

#### Scenario: 减冗余
- **WHEN** 底稿存储
- **THEN** 无 evidencePointers(ev_xxx)、crossSceneFrequency、openObservations、childQuotes 段、predictedObstacles 段
- **AND** evidenceSummary 是人话一句+来源模块标签，非 ID 数组

### Requirement: 底稿增量更新机制（优化版：复用现有链路）

更新分两级，**均复用现有 Job 链，不新开触发源**：

**Level 1 · 增量 patch（复用 memory_write 链尾）**：
- 触发：`memory_write` Job（[queue.ts:132](file:///Users/mac/Desktop/育见-2/src/lib/server/jobs/queue.ts)）`executeWritePlan` 完成后，若非反证轮，链式 `enqueueJob('dossier_patch', { tenant, newFacts }, 'dossier_patch:'+traceId, traceId)`（[decision-engine.ts 尾部](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/write/decision-engine.ts)）
- 机制：`dossierPatcher` Agent 读现有 dossier + 新事实 → 输出 patch（仅改受影响段落 + changeLog）
- 存储：`deep_model_digest` 层追加 `item_id=dossier_v{n}`，旧版保留；`item_id=latest` 指向最新
- 约束：不推翻 `workingHypothesis` 核心

**Level 2 · 全量重概念化（复用 deep_mechanism_review 入口判定）**：
- 触发判定 `shouldReconceptualize(tenant)` 并入 `runDeepMechanismReview` 入口（[pipeline.ts:316](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts)）。任一命中即强制全量重跑（跳过日桶去重）：
  - 反证 ≥2 条针对同一 protective 功能（从 `memory_layer_items` layer=`counter_evidence` 计）
  - 干预无效（任务 feedback 标记未完成 + 同主题家长输入 ≥3 次，从 `turn_events` + `user_tasks` 计）
  - 指纹显著变化（`sourceFingerprint` diff 超阈值）
  - 每 10 有效轮里程碑（现有 `turn-signal.ts`）
  - 四模块采集齐（现有 build 触发）
- 机制：`portraitSynthesizer` 全量重跑，输入含旧 dossier（作前一版假设）+ 全量证据
- 约束：必须 `changeLog` 说明"相比上一版变化 + 原因"

#### Scenario: 日常新反馈增量更新
- **WHEN** 家长日常反馈一条新具体事实（非反证）
- **THEN** memory_write 链尾触发 dossier_patch，dossierPatcher 仅改受影响段落
- **AND** workingHypothesis 核心不变
- **AND** deep_model_digest 层追加 dossier_v{n}，旧版保留

#### Scenario: 反证触发重概念化
- **WHEN** 累计 ≥2 反证针对同一 protective 功能
- **THEN** shouldReconceptualize 命中，deep_mechanism_review 全量重跑 portraitSynthesizer
- **AND** 新 dossier changeLog 说明"XX protective 降权/移除，因 YY 反证"
- **AND** 旧版本保留

### Requirement: 理论卡 Rich Fields 重建

按报告 15 张 × 9 字段重建 `theory-cards.ts`（保持卡名不重命名，补 rich fields）。报告未列的 10 张旧卡降级 SP 自检附录。MVP 第一批 8 张先行（教养控制/强制循环/家校合作/发展任务 + 依恋/共同养育/SDT/阶段环境匹配）。

### Requirement: dossierSlice 前台切片（优化版：双 slice 统一）

`pickFrontendReadPack`（[frontend-read-pack.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/frontend-read-pack.ts)）新增 `dossierSlice` 字段。**matchedMechanisms 双 slice 统一为 8**（修当前 20→40 不一致，[router.ts:245](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/retrieval/router.ts) slice 20 + [frontend-read-pack.ts:82](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/frontend-read-pack.ts) slice 40）。

切片 `sliceForDaily(query, dossier)` 返回：`workingHypothesis` + 相关 1–2 个 perpetuating（带 confidence+evidenceSummary）+ `integratedSynthesis` 首句。SHALL NOT 返回 `ecologicalCalibration`。

#### Scenario: 前台按问题类型取段落
- **WHEN** 家长问"他为什么这样" → dossierSlice 含 familyStruct 摘要 + workingHypothesis
- **WHEN** 家长问"是不是我管太多" → dossierSlice 含 parentPerspectives + integratedSynthesis
- **WHEN** 家长问"怎么办" → dossierSlice 含 interventionTargets + 相关 sceneReadings

---

## MODIFIED Requirements

### Requirement: 深度建模产品宪法（deep-modeling.md）
§2/§7 从"机制闭环强制""互动循环五步"改为"证据分层+整合底稿+理论隐身+增量更新"。新增 §X 底稿更新机制。

### Requirement: 前后台读取契约（read-contract.md）
`matchedMechanisms` 厚包 40/20 不一致 → `dossierSlice` 主源 + `matchedMechanisms` 兜底（统一 8）。

### Requirement: digest 投影（deepModelDigestBuilder）
`mechanismNarrative` 单字段 ← `dossier.integratedSynthesis` + `familyStruct` 摘要。

### Requirement: 前台 SP 字段引用
`parentFacingStyle.md` §三、`dailyDialogueOrchestration.md` §1 改引 `dossierSlice`。

---

## REMOVED Requirements

### Requirement: candidateMechanismMatrix 作为前台主注入源
**Reason**：离散卡导致贴卡。**Migration**：`evidence_networks.candidateMechanismMatrix` 保留写（兜底），`formatMatchedMechanismCards` 降级。Feature flag `PORTRAIT_V3` 默认关。

### Requirement: overallStrength 离散置信度
**Reason**：low/medium/high 无法消长。**Migration**：旧数据保留字段不删；dossier 用 confidence(0-1) 段落叙事。

### Requirement: professional_perspective section 与 THEORY_SOURCES 硬挂
**Reason**：[section-composer.ts:3-16,50-60](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/section-composer.ts) 的 `professional_perspective` section note 直接出现"Bowlby 依恋研究""Patterson 强制循环"等理论名，家长可见，与 v3 理论隐身直接冲突。理论视角已进 `ecologicalCalibration`（内部段），不应再以前台 section 形式出现。`THEORY_SOURCES` 映射与 `theory-cards.ts` 双源漂移。
**Migration**：删除 `professional_perspective` section 产出逻辑 + `THEORY_SOURCES` 常量。`composeHighConfidenceSkeleton` 不再 push 该 section。旧 turn_events 中已有的该 section 数据保留不删（历史记录）。

---

## 附录 A · 试验底稿样例（优化版：减冗余、去概念、去待观察、不依赖孩子原话）

> 7 段 + internal 段。每因素 confidence 含跨场景备注 + evidenceSummary 人话。无术语、无【待观察】、无 ev_xxx、无 childQuotes 段。

### familyStruct
- **亚系统**：母-子二元过度紧密（情感+管理双卷入）｜confidence 0.78（作业/手机/情绪 3 场景现）｜evidence：「学习基本我管」(妈妈原话) + 「周一到周四妈妈都站旁边盯」(作业模块)
- **亚系统**：夫妻冷淡（父亲回避）｜confidence 0.70｜evidence：「爸爸加班多，不怎么说话」(家庭模块)
- **边界**：母-子弥散（监控渗透+情感外包）｜confidence 0.78｜evidence：盯作业 + 「我跟他说爸爸的不好他都听着」(情绪模块)
- **层级**：父母层级弱化（父亲让位）｜亲子倒置风险（小宇用沉默反向控制晚间节奏）｜confidence 0.65
- **联盟**：母-子冲突型联盟，父游离｜confidence 0.72

### fivePs
**presenting**：作业拖延至 23:00 + 催则冲突升级 + 一次踹门

**predisposing**：
- P1 高敏感气质｜confidence 0.78（3/4 场景）｜evidence：「一站旁边就紧」(作业模块) + 检查段姿势紧张
- P2 高自尊-怕「暴露不会」｜confidence 0.65｜evidence：「做错比不做难忍」(沟通模块) + 检查段沉默

**precipitating**：
- PR1 初一课业陡增｜confidence 0.82｜evidence：「小学还好，上初中开始每天吵」(日常模块)
- PR2 父亲缺位加剧｜confidence 0.70｜evidence：家庭模块同上

**perpetuating**（带 id 供引用）：
- M1 催-拖-升级-冷战循环｜id=M1｜confidence 0.80（5/7 晚）｜evidence：日常模块循环记录 + 盯作业
- M2 「做完加任务」隐性规则｜id=M2｜confidence 0.68｜evidence：「做完还有额外的」(妈妈原话) + 拖延配比与任务量正相关
- M3 妈妈焦虑无出口-情感外包｜id=M3｜confidence 0.55｜evidence：家庭模块 + 情绪模块倾诉
- M4 冲突后无修复｜id=M4｜confidence 0.50｜evidence：材料无修复片段 + 踹门后冷战持续

**protective**（带 id + 跨场景配比）：
- PR_t1 拖延维持的「自主权最后口子」｜id=PR_t1｜confidence 0.72（作业前/手机收缴前）｜evidence：盯作业 + 妈妈已排满今晚
- PR_t2 沉默维持的「不暴露不会」｜id=PR_t2｜confidence 0.61（检查段）｜evidence：检查段沉默
- PR_t3 沉默作为「对指挥的消极抵抗」｜id=PR_t3｜confidence 0.55（催促后/加任务后）｜evidence：催促后沉默加重
- **交织**：PR_t1/PR_t2/PR_t3 在作业前场景同时成立，配比 {PR_t1:0.6, PR_t2:0.3, PR_t3:0.5}，互相喂养（见 workingHypothesis）

### sceneReadings
- **作业开始前**：protective {PR_t1:0.6, PR_t3:0.5, PR_t2:0.3}｜主 perpetuating M1｜reading：以抢自主为主，三样同时在场
- **检查订正段**：protective {PR_t2:0.7, PR_t3:0.4, PR_t1:0.2}｜主 perpetuating M4｜reading：以怕暴露为主，拖延非主形态
- **冲突后**：protective {PR_t3:0.7, PR_t1:0.3}｜主 perpetuating M4｜reading：沉默升级冷战，修复缺失是关键

### parentPerspectives
- **妈妈**：intent=关心+怕落后｜childReception=不被信任｜actualImpact=越盯越退｜blindSpot=把沉默当接受、把拖延当态度差｜receptivity=0.55
- **爸爸**：intent=不添乱｜childReception=缺席｜actualImpact=让妈妈更紧、孩子更孤立｜blindSpot=以为不管=不添乱｜receptivity=0.30

### workingHypothesis（无术语，可证伪）
小宇的拖延和沉默不是态度问题。他在妈妈独自扛学习、初一课业变重的局面里，用同一组行为同时撑住三样正在一起塌的东西：今晚节奏的自主权（PR_t1）、不暴露不会的自尊（PR_t2）、对妈妈连番指挥的消极抵抗（PR_t3）。这三样在作业前以六成自主、三成怕暴露、五成抗指挥同时在场，互相喂养——越怕暴露越拖，越拖妈妈越催，越催抗指挥越重，越抵抗越要靠拖延保自主。踹门是这套局面绷到极点的信号，不是他变坏了。

**predictions**：
- pred_1：妈妈不盯的晚上（爸爸管或妈妈外出），若 PR_t1 主因→拖延减轻；若 PR_t2 主因→不减
- pred_2：改「做完加任务」为「做完这段归你」（破 M2），若 M2 为真→效率回升
- pred_3：引入冲突后修复（破 M4），若 M4 为真→冷战时长缩短
- 任一 prediction 失败→触发重概念化

### interventionTargets（obstacle 并入此）
- T1｜targets=M1｜action=选一晚作业开始前 20 分钟妈妈不进房间不催，结束只问「今晚哪段最卡」｜prediction=pred_1｜obstacle=妈妈难自察监控密度（「我那是关心不是盯」），执行打折
- T2｜targets=M2｜action=把「做完加任务」改「做完这段归你」｜prediction=pred_2｜obstacle=爸爸若介入方式是「帮妈妈一起盯」会加重 M1
- T3｜targets=M3｜action=建议妈妈建成人倾诉渠道（非孩子）｜prediction=破 M3 后盯密度下降｜obstacle=同 O1
- T4｜targets=M4｜action=冲突后 24h 内妈妈主动一句修复性话（非道歉，「昨晚我急了」）｜prediction=pred_3｜obstacle=沉默后妈妈间歇性放松（愧疚）会间歇强化沉默，T4 失效

### ecologicalCalibration（内部，不进 dossierSlice）
活跃层：micro（高监控+心理控制边界模糊）、meso（父亲缺位无第二缓冲）、macro（「严师出高徒」文化脚本+升学比较）、chrono（升初一转折）。理论透镜自检：教养与控制方式、强制循环、SDT、阶段—环境匹配、依恋。外系统材料不足暂不启用。

### integratedSynthesis（唯一散文段，无术语，200-400字）
小宇十三岁，初一。他是个高敏感的孩子——妈妈往书桌边一站，话没出口他肩膀已经紧了。他自尊很高，最怕的不是题难，是被当场指出「不会」。在妈妈独自扛学习、初一课业变重的局面里，他用拖延和沉默同时撑住三样正在一起塌的东西：今晚节奏的自主权、不暴露不会的自尊、对妈妈连番指挥的消极抵抗。这三样在作业前以六成自主、三成怕暴露、五成抗指挥同时在场，互相喂养——越怕暴露越拖，越拖妈妈越催，越催抗指挥越重，越抵抗越要靠拖延保自主。妈妈不是控制欲强，是被这套局面逼到只能用「盯」表达关心；她的关心落到小宇身上是「又被盯着了」，两人都在说真话但听不懂对方。爸爸的缺位不是中立，是让局面更紧的力。踹门不是变坏，是绷到极点。要帮的不是改态度——态度是这三样塌出来的形状。要先看清：撤掉「被盯」这股力，这三样会不会松一点；松了说明自主是主因，方向是给空间；不松说明怕不会才是底，要换支点。

### alternativeReadings
- H_A（主）：拖延主因=对高监控的回应（PR_t1+PR_t3）｜confidence 0.72｜distinguishingEvidence=需 pred_1 验证（爸爸在场仍拖？）
- H_B：拖延主因=怕暴露不会（PR_t2）｜confidence 0.45｜distinguishingEvidence=需「爸爸在场仍拖」证据
- H_C：拖延含依恋「不可达」（M4 关联）｜confidence 0.30｜distinguishingEvidence=需「修复引入后冷战缩短」证据，现保留

### 前端取用映射
- **daily**：workingHypothesis + 相关 1–2 个 perpetuating（带 confidence+evidenceSummary）+ integratedSynthesis 首句
- **rehearsal**：protective PR_t1–t3 + perpetuating M1/M2 + 该场景 sceneReadings 配比
- **profile**：familyStruct + fivePs 全量 + workingHypothesis + interventionTargets + alternativeReadings，渲染结构化卡片
- **tasks**：interventionTargets T1–T4（带 targets + prediction + obstacle）

---

## 附录 B · 字段流转链路表（写入方/接收方/生产链路，扎根探测）

| 字段 | 写入方（Agent/Job） | 写入时机 | 存储层 | 接收方 | 流转链路 |
|------|---------------------|---------|--------|--------|---------|
| familyStruct | portraitSynthesizer（deep_mechanism_review Job） | Level 2 重概念化 | deep_model_digest (schema v2) | dossierSlice.profile / digest投影 | pipeline.ts → saveDeepModelDigest → loadDeepModelDigest → pickDeepModelDigestPack → dossierSlicer.sliceForProfile |
| fivePs.* | portraitSynthesizer | Level 2 | 同上 | dossierSlice.daily/profile | 同上 + sliceForDaily 按 query 选 perpetuating |
| sceneReadings | portraitSynthesizer | Level 2 | 同上 | dossierSlice.rehearsal/daily | sliceForRehearsal 按场景选 |
| parentPerspectives | portraitSynthesizer | Level 2 | 同上 | dossierSlice.daily（问家长时） | sliceForDaily 按 query 类型 |
| workingHypothesis | portraitSynthesizer（L2）/ dossierPatcher（L1 不改核心） | L2 全量 / L1 不动 | 同上 | dossierSlice.daily 主取材 | loadDeepModelDigest → pickDeepModelDigestPack.workingHypothesis → prose payload |
| interventionTargets | portraitSynthesizer | Level 2 | 同上 | dossierSlice.tasks | sliceForTasks → tonightTaskGenerator |
| integratedSynthesis | portraitSynthesizer（L2）/ dossierPatcher（L1 可微调） | L2 / L1 | 同上 | dossierSlice.daily 首句 | digest投影.mechanismNarrative ← integratedSynthesis |
| alternativeReadings | portraitSynthesizer | Level 2 | 同上 | dossierSlice.profile | sliceForProfile |
| ecologicalCalibration | portraitSynthesizer | Level 2 | 同上（不进 slice） | 仅内部 | 不进 dossierSlice |
| dossier 版本 | saveDeepModelDigest（item_id=dossier_v{n}） | 每次 L1/L2 | deep_model_digest | getDossierHistory | 不进前台 |
| evidenceSummary（每因素） | portraitSynthesizer 从 evidenceLedger 摘 | L2 | 随因素存 | dossierSlice | 不单独流转，随因素 |
| prediction | portraitSynthesizer | L2 | 随 workingHypothesis | interventionTargets.prediction 引用 | shouldReconceptualize 监测失败 |
| matchedMechanisms（兜底） | mechanismSynthesizer 旧链路（flag 关时） | deep_mechanism 旧路径 | evidence_networks | formatMatchedMechanismCards（slice 8） | 现有链路不变，dossier 缺失时用 |

---

## 附录 C · 底稿演进例示（v1 → v2 patch → v3 重概念化）

### v1（初始，四模块采集后，附录 A 全文）
- workingHypothesis 主假设 H_A：拖延主因=对高监控回应（PR_t1+PR_t3）｜confidence 0.72
- interventionTargets：T1（针对 M1，不催那晚）为主

### v2（Level 1 增量 patch，复用 memory_write 链尾）

**触发**：家长日常反馈「昨天爸爸管了一晚，他还是拖，但没顶嘴」（新事实，非反证）  
**机制**：memory_write executeWritePlan 完成 → 链式 enqueueJob('dossier_patch') → dossierPatcher 读 v1 + 新事实 → 输出 patch  
**写入**：deep_model_digest 层 item_id=dossier_v2，v1 保留，item_id=latest 指 v2

**patch diff**：
- evidenceLedger（内部）：[+] 「昨天爸爸管了一晚，他还是拖，但没顶嘴」(日常轮)
- sceneReadings：[~] 新增「与爸爸单独的晚上」场景：protective {PR_t2:0.6, PR_t1:0.3, PR_t3:0.2}｜主 perpetuating M4
- alternativeReadings：[→] H_B confidence 0.45→0.58（爸爸在场仍拖支持 H_B）｜[→] H_A 0.72→0.66
- workingHypothesis：[~] 追加「但爸爸在场仍拖提示怕暴露不会（PR_t2）权重可能被低估，pred_1 部分证伪」
- integratedSynthesis：[~] 核心不变（H_A 仍主），补「爸爸那晚他仍拖，说明怕不会可能比我们以为的更重」
- changeLog：[+] 「v2: 新事实(爸爸管仍拖)，H_B 升 0.13/H_A 降 0.06，核心未变」

**约束校验**：workingHypothesis 核心未推翻 ✓ ｜ 旧版 v1 保留 ✓

### v3（Level 2 重概念化，复用 deep_mechanism_review 入口判定）

**触发**：shouldReconceptualize 命中——① v2 后家长反馈「试了不催那晚(T1)，他还是拖，但情绪没那么炸」(pred_1 部分失败) + ② 同主题(拖延)家长输入累计 ≥3 次 + ③ 任务 T1 feedback 标记未达预期  
**机制**：deep_mechanism_review Job 入口 shouldReconceptualize 命中 → 强制全量重跑 portraitSynthesizer（跳过日桶去重）→ 输入含 v2(作前一版假设)+全量证据  
**写入**：item_id=dossier_v3，v1/v2 保留

**重概念化 diff（相对 v2）**：
- evidenceLedger：[+] 「T1 执行：不催那晚仍拖，但情绪没那么炸」、「同主题第3次提及拖延」
- perpetuating：[~] M1 confidence 0.80→0.62（T1 部分失效）｜[+] M5 任务胜任感受阻（怕不会导致回避）confidence 0.70
- protective：[→] PR_t2 confidence 0.61→0.74（升主）｜[→] PR_t1 0.72→0.55（降，T1 撤监控仍拖证伪 PR_t1 主导）
- sceneReadings：[~] 作业前配比 {PR_t1:0.6,PR_t3:0.5,PR_t2:0.3}→{PR_t2:0.6,PR_t1:0.4,PR_t3:0.3}
- workingHypothesis：[~] **核心改写**：从「拖延主因对高监控回应(H_A)」改为「拖延主因怕暴露不会(H_B)，高监控是放大器非根因」。predictions 重列 pred_1'/pred_2'
- alternativeReadings：[→] H_B 0.58→0.74（升主）｜[→] H_A 0.66→0.40
- interventionTargets：[~] T1 降级（仍用非主）｜[+] T5 targets=M5 action=任务拆小+「你指给我看哪步卡」prediction=pred_2' obstacle=小宇可能把拆小读为「妈妈又来安排」需让他自己选拆法
- integratedSynthesis：[~] **整段重写**：「……T1 那晚他仍拖说明我们之前高估了『被盯』的权重——他怕的不是被盯着，是被盯着的时候暴露不会。撤监控没用的部分原因，是监控撤了但『怕不会』还在。方向要换：不是给空间，是降暴露感……」
- changeLog：[+] 「v3: 重概念化。触发=干预无效(T1)+同主题≥3次。核心变化：H_A→H_B 主因转移，PR_t2 升主保护(0.61→0.74)，新增 M5 胜任感受阻，主靶点 T1→T5。原因：T1 证伪 PR_t1 主导 + 检查段佐证 PR_t2」

**约束校验**：核心被推翻合法（L2 允许）✓ ｜ 显式说明变化原因 ✓ ｜ 旧版保留 ✓ ｜ predictions 全更新 ✓

### 演进例示要点
1. **L1 保核心**：v2 新事实只调置信度与边缘段落，workingHypothesis 核心不动
2. **L2 改核心**：v3 因干预无效触发，重写 workingHypothesis + integratedSynthesis + 强制说明为什么变
3. **版本追加不覆盖**：v1/v2/v3 全保留，getDossierHistory 可追溯
4. **因素 ID 跨版本稳定**：M1/PR_t1/T1 跨版本不变，置信度变化可追——权重消长精确实现
5. **prediction 是测试锚**：pred_1 失败直接触发重概念化

---

## 附录 D · 真实数据待办（Task 0）

附录 A/C 用假设家庭。实施第一步须从数据库拉真实家庭数据校验形态丰富度。本次尝试连接生产库失败（password authentication failed，疑密码轮换），需 DBA 核对 `~/yujian/.env.local` 的 DATABASE_URL 与实际 PG 密码。

Task 0 产出（不拉原始可识别文本，仅聚合结构）：
- 数据最丰富家庭（memory_layer_items 最多 + 四模块齐 + ≥20 daily turns）的 layer_name 计数、场景分布、证据类型分布
- 验证附录 A familyStruct/fivePs/sceneReadings 能否被真实数据填充
- 写入 `.trae/documents/portrait-real-data-validation.md`（本地不入库，PII 保护）

---

## 附录 E · 更新机制数据流（扎根现有代码，复用不新建）

```
家长日常反馈
  ↓
turn_events (L0, route.ts:108 saveTurnEvent)  ← 现有
  ↓
[门控] shouldWriteL1 = !safety && relType!=='insufficient' && !短寒暄 (route.ts:125)
  ↓
episode_ingest (Job A, route.ts:159)  ← 现有，加 evidenceTier/ecologicalLayer/factRole 元数据
  ↓
memory_write (Job B, route.ts:147)  ← 现有
  └─ executeWritePlan (decision-engine.ts:200)
     ├─ saveDailyInteractionUpdate / saveEvidenceNetwork / savePendingHypotheses / saveFamilyInteractionCycles
     ├─ 链式 → digest_update (日桶) [现有]
     ├─ 链式 → model_review (若有假设) [现有]
     ├─ 链式 → deep_mechanism_review (日桶) [现有]
     └─ [新增] 链式 → dossier_patch (非反证轮) ← Level 1 挂这里
         └─ dossierPatcher Agent
            - 读: deep_model_digest latest dossier + 本批新事实
            - 输出: patch (改哪些段+changeLog)
            - 写: deep_model_digest item_id=dossier_v{n} 追加, latest 指向新
            - 约束: 不推翻 workingHypothesis 核心
  ↓
[Level 2 触发判定] shouldReconceptualize ← 并入 deep_mechanism_review 入口 (pipeline.ts:316)
  - 反证≥2同功能 / 干预无效 / 指纹变化 / 10轮 / 四模块齐
  ↓ (触发时, 跳过日桶去重强制全量)
deep_mechanism_review Job [现有, 内部改]
  ├─ ecosystemClassifier → theoryMatcher [现有, 保留]
  ├─ portraitSynthesizer [新, 取代 mechanismSynthesizer 为主路径]
  │   - 读: 全量证据 + 旧 dossier (作前一版假设)
  │   - 输出: 全新 dossier + changeLog
  │   - 写: deep_model_digest item_id=dossier_v{n} 追加
  ├─ structuralRiskExtractor [现有, 保留]
  └─ buildDeepModelDigest [改: 从 dossier 投影, 非取 topMechanism.description]
      └─ saveDeepModelDigest (item_id=latest 指向新)
  ↓
dossierSlice (pickFrontendReadPack 新增字段)
  - sliceForDaily(query, dossier) / sliceForRehearsal / sliceForProfile / sliceForTasks
  ↓
前台 LLM (prose + section) [现有 3 处调用不变]
  - streamProseAndSections (主, Text Stream)
  - fillDailySectionCopy (hidden, Fast JSON)
  - generateDailyProse (safety, Text Stream)
```

**关键复用点**：
- 不新建 Job 类型外的触发源（dossier_patch 是新 Job 类型但挂在 memory_write 链尾）
- 不新建存储表（复用 deep_model_digest 层 schema v2）
- 不新建前台 LLM 调用（3 处不变，只换 payload 字段源）
- shouldReconceptualize 并入现有 deep_mechanism_review 入口，不新开定时器

---

## 附录 F · 实施约束：AI 产品工程 14 条规则（强制）

本 spec 实施阶段 MUST 遵守以下 14 条工程规则（用户提供的精炼版，作为实施硬约束）：

1. **全链路分析先行**：任何修改前必须输出「当前流程理解 + 问题分析 + 修改计划」（Frontend→BFF→Backend→Database→AsyncJob→Agent→LLM→UI 全链路），禁止直接改代码。
2. **增量变更**：一次只解决一个明确问题，禁止无关重构/顺手改架构/修改多个系统边界。每次修改声明 Goal 与 Non-goal。
3. **契约优先**：所有模块边界（Frontend↔BFF、BFF↔Backend、Backend↔Job、Agent↔Agent、Agent↔LLM）必须有明确契约，字段含 Name/Type/Required/Source/Lifecycle/Meaning。禁止猜字段、临时字段、undefined 链路传播、Agent 自由文本通信。
4. **状态管理**：复杂流程显式状态机，禁止大量 boolean 控制流程。状态含 State/Owner/Storage/Transition/Trigger。
5. **异步 Job**：长任务 Job 化，支持 id/status/progress/result/error/retry，考虑页面刷新恢复/重复执行/超时/失败恢复/幂等性。
6. **Agent 工作流**：每个 Agent 定义 Purpose/Input Schema/Output Schema/Tools/LLM Strategy/Failure Handling。Agent 间传结构化消息，禁止不可解析文本。
7. **LLM Runtime**：业务代码禁止直接调模型，统一 Business→Agent Runtime→LLM Gateway→Model。考虑 Prompt 版本/Token 限制/Timeout/Retry/Output 校验/Streaming。
8. **前端状态**：AI 交互页处理 idle/loading/streaming/success/error，按钮 disabled/loading/防重复提交，移动端检查 iPhone 13/键盘弹出/页面滚动/状态恢复。
9. **数据一致性**：Input→Validation→Transform→Storage→Consume。新增字段说明来源/生成位置/存储位置/生命周期。
10. **可观测性**：复杂流程可追踪，含 Request ID/User ID/Job ID/Agent ID，能定位 用户请求→接口→任务→Agent 链→LLM 调用。
11. **三轮验证**：第一轮代码（typecheck+build，TS 错误/无用代码/Secret 泄露）→ 第二轮产品流程（页面/按钮/Loading/Streaming/数据保存/刷新恢复）→ 第三轮系统一致性（Contract/字段/状态/Agent 流程/Job 执行）。
12. **Final Report**：修改的问题/文件/原因/全链路影响/三轮验证结果/风险与待优化。
13. **Stop Rule**：不确定业务规则/字段含义/影响核心流程/Agent 协议/数据迁移/Async Job 行为时必须先询问，不自行假设。
14. **本 spec 特化约束**：dossier 字段流转遵循附录 B 链路表；不新建 Job/表/LLM 调用（附录 E 复用点）；理论卡 15 vs 20 不纠结（保持现状补 rich fields）；前台改动遵守附录 G 优化点。

---

## 附录 G · 前台 SP 全链路优化点（R1-R5，来自 [front-agent-sp-redundancy-audit.md](file:///Users/mac/Desktop/育见-2/.trae/documents/front-agent-sp-redundancy-audit.md)）

dossier v3 落地时一并修前台 5 个冗余/不一致点：

### R1 · hidden payload 带全包（中度冗余）
- **问题**：[parent-facing-copy.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts) hidden 调用 payload 带完整 retrievalPack，与主调用 payload 高度重叠，二次喂厚包。
- **优化**：hidden payload 只带 `dossierSlice` + 该 hidden section 的 skeleton + 简短上下文，不带完整 retrievalPack。预估省 30-40% hidden 调用 input token。
- **入 Task**：Task 13 新增 SubTask 13.4。

### R2 · professional_perspective section 理论硬挂（重度，与 v3 冲突）
- **问题**：[section-composer.ts:3-16,50-60](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/section-composer.ts) 硬编码 `THEORY_SOURCES` 映射 + `professional_perspective` section note 直接出现"Bowlby 依恋研究""Patterson 强制循环"等理论名，家长可见，与 v3 理论隐身直接冲突。
- **优化**：删除 `professional_perspective` section 与 `THEORY_SOURCES` 映射。理论视角已进 `ecologicalCalibration`（内部），不应再以前台 section 形式出现。
- **入 spec**：新增 REMOVED Requirement「professional_perspective section 与 THEORY_SOURCES 硬挂」。

### R3 · parentFacingCopy.md 字段名漂移（中度）
- **问题**：[parentFacingCopy.md:85,87](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) §气质参照 + §果断与念读 仍写"取材 deepModelDigest.mechanismNarrative / childStructureModels"，v3 改 `integratedSynthesis` 后字段名漂移。
- **优化**：字段引用从 `mechanismNarrative` → `dossierSlice.workingHypothesis / integratedSynthesis`；"属于…这一类"句式改为"在…场景里他更容易…"（条件化非贴标签）。
- **入 Task**：Task 13.1 补 parentFacingCopy.md 同步。

### R4 · 禁止词列表未同步 v3（轻度）
- **问题**：[parentFacingCopy.md:97-102](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) §禁止词 未含 v3 新禁术语（稳态/强制循环/homeostasis/三角化/SDT/亚系统/边界弥散等 familyStruct/fivePs 内部段术语）。
- **优化**：§禁止词 补 v3 术语禁令清单，与 spec「底稿 SHALL NOT 含」同步。
- **入 Task**：Task 13.1 补。

### R5 · taskTitle 双提炼（轻度）
- **问题**：[prose-section-stream.ts:45](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/prose-section-stream.ts) 主调用末尾要求 LLM 输出 taskTitle，同时 `tonightTaskGenerator` Agent 后台再润色——双提炼。
- **优化**：v3 落地后，主调用 taskTitle 改为直接取 `dossierSlice.interventionTargets[0].action`（dossier 已有结构化干预靶点），不让主 LLM 现编。tonightTaskGenerator 改为"从 interventionTargets 选最贴合本轮 + 润色"。
- **入 Task**：Task 13 新增 SubTask 13.5。

### R6 · "要方法就沉默"的 SP 死板（重度，6 根因）
- **问题**：家长要方法时 Agent 倾向沉默/只给解释。6 个系统性根因：
  - S1 [parentFacingStyle.md:72-80](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) §五「低误判追问」最高优先级，要方法被当"信息不够"→追问
  - S2 [parentFacingStyle.md:124-127](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) §九概括分级，低置信走 follow_up/light，prose 变短+追问，方法被推 section
  - S3 [parentFacingStyle.md:84-91](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) §六"候选解释+不停中间变量"强制先解释，方法被挤到 advice
  - S4 [orchestration/pipeline.ts:347](file:///Users/mac/Desktop/育见-2/src/lib/server/orchestration/pipeline.ts) `ask_advice && canExplain → model_based_explanation`，把"要方法"翻译成"给解释"
  - S5 [parentFacingCopy.md:76](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) advice section 硬限"一个小动作 80-150 字"
  - S6 [parentFacingStyle.md:80](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) §九"深度结论放 section"，方法在 prose 与 section 双重受限
- **优化（dossier v3 解法）**：方法不再靠 Agent 现编或硬限一个，从 `interventionTargets` 结构化靶点取：
  - S1：dossier v3 SP 区分"要方法"与"信息不够"，要方法时优先取 `interventionTargets`，只有 `relationshipType=insufficient` 才追问
  - S2：引入 `ask_advice` 专属 proseMode，不套 follow_up/light 短模板；要方法时 prose 可直接给 1 个靶点 action
  - S3：advice section 改"先一句为什么（引 workingHypothesis）+ interventionTarget.action + prediction + obstacle"，解释与方法一体
  - S4：orchestration `ask_advice && canExplain` 时 frontResponseType 从 `model_based_explanation` 改为 `advice_from_dossier`（新枚举），区分"要解释"与"要方法"
  - S5：advice section 字数上限放宽 150-250 字，允许 1-2 个 interventionTargets，每个必带 prediction+obstacle
  - S6：`ask_advice` 轮 prose 可含一个 interventionTarget.action 一句话（"今晚可以试：…"）
- **入 Task**：Task 13 新增 SubTask 13.6（SP 改）+ Task 13 新增 SubTask 13.7（orchestration 路由加 advice_from_dossier 枚举）。

### 健康部分（保留不改）
- section-composer 纯规则产骨架（不调 LLM）✓
- prose-section-stream 合并 prose+section 一次调用 ✓（已优化消除 7.6s 排队）
- parentFacingStyle 六类拆解 + 低误判追问 + 概括演进 ✓
- fillDailySectionCopy 并行预取 hidden ✓

---

## 附录 H · 关联文档索引

- [execution-playbook.md](./execution-playbook.md) —— **安全实施协议**（PR 切片、consumer 门禁、三轮验证、GLM 分工、Stop Rule）
- [bff-three-phase-overview.md](file:///Users/mac/Desktop/育见-2/.trae/documents/bff-three-phase-overview.md) —— BFF 三段式独立整理（段①规则编排/段②组装厚包/段③LLM 表达）
- [front-agent-sp-redundancy-audit.md](file:///Users/mac/Desktop/育见-2/.trae/documents/front-agent-sp-redundancy-audit.md) —— 前台 SP 全链路冗余检测报告（R1-R6 详证）
- [portrait-v3-theory-aligned-rebuild.md](file:///Users/mac/Desktop/育见-2/.trae/documents/portrait-v3-theory-aligned-rebuild.md) —— v3 理论对齐探索文档
- [portrait-v3-fullchain-grounded-rebuild.md](file:///Users/mac/Desktop/育见-2/.trae/documents/portrait-v3-fullchain-grounded-rebuild.md) —— v3 全链路扎根探索文档
- 理论真源：`/Users/mac/Desktop/副本对话实验室中五大生态系统的教育理论与判断机制映射报告.docx`（已提取校准）

---

## 附录 I · 安全实施摘要（详版见 execution-playbook.md）

### I.1 为何现有 tasks 还要加「执行层」

spec/tasks 定义 **做什么**；execution-playbook 定义 **怎么改才不会漏**。针对四类失败模式：

| 失败模式 | 协议对策 |
|----------|----------|
| 大 diff 漏 consumer | 单 PR ≤5 文件、单 SubTask；附录 B producer→consumer grep 门禁 |
| GLM 顺手多改 | 语音/HANDOFF/deploy 默认禁止；每 PR 必填 Goal/Non-goals |
| 调试闭环浅 | 每 PR 最小验证集（typecheck + 契约脚本 + 路径子集） |
| 长链路打架 | 单一真源顺序 §5.1；PORTRAIT_V3 on/off 双路径对称 |

### I.2 Phase 与 PR 映射（实施顺序不可乱）

1. **PR-0 → PR-B1…B4**（Phase B）：仅工程优化，**零 dossier 行为变更**，可独立上线/回滚。
2. **PR-C1…C8**（Phase C）：schema → synthesizer → patch → 投影 → slicer，**禁止**在 C8 前改 parentFacingStyle 引 dossierSlice。
3. **PR-D1…D5**（Phase D）：宪法/SP/契约/flag，依赖 C8。
4. **PR-E**（Task 16）：全量三轮验证 + **用户明确 deploy**。

### I.3 关键 Stop Rule（实施前必问）

- 动 `packages/contracts` / daily NDJSON 形态
- 无兜底删除 matchedMechanisms
- 新建 DB 表（spec 禁止）
- 波及 voice/ASR 链路
- Task 0 生产库不可连却要做真实家庭验收

### I.4 理论报告与实施对齐点

报告要求 **「分层判断引擎、先证据后解释、理论隐身」**——与 spec 一致。实施时：

- **theory-cards rich fields** 进 system/cache（PR-C1），**不出** dossierSlice
- **置信度规则** 写进 portraitSynthesizer SP + shouldReconceptualize（证据 tier 来自 episode 元数据 PR-C6）
- **四功能切片** 由 dossierSlicer 确定性实现（daily/rehearsal/profile/tasks），禁止四个功能各写一套 LLM 逻辑
