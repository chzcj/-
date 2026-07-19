# Cursor 修 SP/重链路 · 检察官检查清单（Trae 用）

> 角色：我是检察官，审 Cursor 修 SP/重链路的产出。Cursor 5 类典型错误（你担心的）逐条列检查项，每项标"依据"（我手里哪份文档）+"红线"（不达标必打回）。
> 你把 Cursor 的产出（SP 改后文本/代码 diff/它的自述）发我，我按本清单逐条判断。

---

## 风险 1 · 照搬旧链路，没思考更新后的 v3 链路

**你担心的**：Cursor 按过往链路来，没去想更新后的电路（dossier v3）。

### 检查项
- [ ] 1.1 Cursor 改的每个 SP/代码，是否引用了 dossier v3 字段（`dossierSlice`/`workingHypothesis`/`integratedSynthesis`/`interventionTargets`），而非仍写 `matchedMechanisms`/`mechanismNarrative`？
  - 依据：spec 附录 G R3（字段名漂移）+ Task 13.1
  - 红线：SP 里仍出现 `取材 deepModelDigest.mechanismNarrative / childStructureModels` → 没改
- [ ] 1.2 是否提到 `portraitSynthesizer` 取代 `mechanismSynthesizer`（在 deep_mechanism_review Job 内，非新建 Job）？
  - 依据：spec What Changes + Task 7.2
  - 红线：Cursor 新建了独立 Job 或新触发源 → 违反"复用不大修"
- [ ] 1.3 是否提到 `dossier_patch` 挂在 `memory_write` 链尾（非反证轮），而非新建定时器？
  - 依据：spec 附录 E + Task 8.3
  - 红线：新建定时器或独立触发源 → 违反复用原则
- [ ] 1.4 `shouldReconceptualize` 是否并入 `runDeepMechanismReview` 入口（pipeline.ts:316），而非另开？
  - 依据：spec Task 7.4
  - 红线：另开判定函数且不挂现有入口

---

## 风险 2 · 没反推"前台/后台 SP 该输出什么"，只改骨架不填肉

**你担心的**：Cursor 没真正思考 SP 该输出什么内容，反推怎么完善丰富 SP。

### 检查项
- [ ] 2.1 portraitSynthesizer SP 是否写清**7 段输出结构**（familyStruct/fivePs/sceneReadings/parentPerspectives/workingHypothesis/interventionTargets+obstacle/ecologicalCalibration+integratedSynthesis+alternativeReadings）？
  - 依据：spec「底稿段落」+ 附录 A 样例
  - 红线：SP 只写"产出 dossier"没列 7 段 → 便条骨架（违反 sp-content-depth.mdc 铁律）
- [ ] 2.2 每段是否写了**字段要求**（每因素带 confidence 0-1 含跨场景备注 + evidenceSummary 人话+来源模块）？
  - 依据：spec 减冗余决策 + 附录 A
  - 红线：SP 只写"输出 familyStruct"没说每项带 confidence+evidenceSummary
- [ ] 2.3 workingHypothesis SP 是否要求**≥2 条可证伪 predictions + 失败触发重概念化**？
  - 依据：spec + 附录 A workingHypothesis 段
  - 红线：SP 没写 predictions 可证伪性
- [ ] 2.4 dossierPatcher SP 是否要求**仅改受影响段落 + 不推翻 workingHypothesis 核心 + changeLog**？
  - 依据：spec Task 8.1 + 附录 C v2 patch
  - 红线：SP 没写"不推翻核心"约束
- [ ] 2.5 前台 SP（parentFacingStyle/parentFacingCopy/orchestration）是否解决 R6"要方法就沉默"——区分"要方法"与"信息不够"、advice section 放宽 150-250 字允许 1-2 靶点带 prediction+obstacle？
  - 依据：spec 附录 G R6 + Task 13.6/13.7
  - 红线：SP 仍把"要方法"当"信息不够"走追问；advice 仍硬限"一个小动作 80-150 字"

---

## 风险 3 · 缺乏契约/整链了解，字段对不上

**你担心的**：Cursor 缺乏对契约、整链的了解。

### 检查项
- [ ] 3.1 Cursor 是否读过 [docs/contracts/read-contract.md](file:///Users/mac/Desktop/育见-2/docs/contracts/read-contract.md) 厚包 10 字段 + slice 上限？
  - 依据：BFF 三段式文档 段②字段表
  - 红线：改 matchedMechanisms slice 没统一为 8（仍 20/40 不一致）
- [ ] 3.2 是否读过 [packages/contracts/src/daily-stream.ts](file:///Users/mac/Desktop/育见-2/packages/contracts/src/daily-stream.ts) DailyStreamEvent/DailySection 契约？
  - 依据：spec Impact「契约不变」
  - 红线：Cursor 改了 DailyStreamEvent/DailySection 形态 → 小程序要跟着改，违反"零改"
- [ ] 3.3 dossierSlice 加到 `pickFrontendReadPack` 的 `FRONTEND_READ_PACK_KEYS` 是否与 `buildDailyDialogueRetrievalPacket` 填充对齐？
  - 依据：spec Task 11.2/11.3 + 附录 B 字段流转表
  - 红线：加了字段但 router.ts 没填，或填了但 frontend-read-pack 没读
- [ ] 3.4 每个 dossier 字段是否在附录 B 字段流转表里有"写入方/接收方/流转链路"？
  - 依据：spec 附录 B
  - 红线：Cursor 新增字段没说明 producer/storage/consumer（违反 ai-product-engineering.mdc）

---

## 风险 4 · 没读数据库真实数据，臆想字段

**你担心的**：Cursor 没对数据库大量信息了解收集，臆想不必要的东西。

### 检查项
- [ ] 4.1 Cursor 是否拉过真实家庭的 memory_layer_items 聚合结构（按 layer_name 计数/场景分布/证据类型）？
  - 依据：spec Task 0 + portrait-real-data-validation.md
  - 红线：Cursor 直接写 SP 没看真实数据 → 字段可能填不进
- [ ] 4.2 familyStruct/fivePs/sceneReadings 的 evidenceSummary 引用的"来源模块标签"（作业模块/日常模块/妈妈原话等）是否对应真实 memory_layer_items 的 layer_name？
  - 依据：spec 附录 A evidenceSummary 标签
  - 红线：SP 写了真实库没有的 layer 名
- [ ] 4.3 是否确认 `deep_model_digest` 层 schema v2（item_id=dossier_v{n} + latest）在 db.ts schema 里能落？
  - 依据：spec Task 6.1
  - 红线：schema 没加 schemaVersion 字段或历史版本机制
- [ ] 4.4 shouldReconceptualize 的"反证≥2""同主题≥3次"是否查过 `memory_layer_items` layer=`counter_evidence` 与 `turn_events`+`user_tasks` 真实可查？
  - 依据：spec Task 7.4
  - 红线：判定条件用的字段 DB 里没有

---

## 风险 5 · 中间层 Agent 断层，靠便签完成任务

**你担心的**：中间某个后端 Agent（既非最深也非最浅）获取信息不足，输出质量差，靠便签。

### 检查项（逐个中间 Agent）
- [ ] 5.1 **ecosystemClassifier**：输入是否有足够事实（不是空跑）？输出 ecosystemMap 是否被 theoryMatcher 真正消费？
  - 依据：全链路探测 B8 step1-2
  - 红线：ecosystemClassifier 输出没人读，或输入只有 1-2 条事实
- [ ] 5.2 **theoryMatcher**：输入是否含 ecosystemMap + 完整 THEORY_CARDS（15 张×9字段）？输出是否进 portraitSynthesizer？
  - 依据：spec Task 5 + B8 step2
  - 红线：theoryMatcher 输出 theoryCardId 但 portraitSynthesizer 不读（理论卡应作透镜不进输出）
- [ ] 5.3 **portraitSynthesizer**（新）：输入是否含**全量证据 + 旧 dossier（作前一版假设）**？若缺旧 dossier，重概念化时无法说"相比上一版变化"。
  - 依据：spec Task 7.3 + 附录 C v3
  - 红线：portraitSynthesizer 输入没有旧 dossier → changeLog 写不出
- [ ] 5.4 **dossierPatcher**（新）：输入是否含**现有 dossier + 本批新事实**？若只给新事实不给旧 dossier，patch 无从改起。
  - 依据：spec Task 8.4
  - 红线：dossierPatcher 只收新事实不收旧 dossier
- [ ] 5.5 **structuralRiskExtractor**：是否仍被调用？输出是否进 digest？
  - 依据：全链路探测 B8 step5
  - 红线：v3 改链后 structuralRiskExtractor 被遗漏
- [ ] 5.6 **digestBuilder**（确定性拼）：是否改为从 dossier 投影，而非仍取 topMechanism.description？
  - 依据：spec Task 10.1
  - 红线：digest 仍是 topMechanism.description → dossier 白建
- [ ] 5.7 **前台 parentFacingCopy**：hidden 调用 payload 是否改薄（R1，只带 dossierSlice+skeleton 不带全 retrievalPack）？
  - 依据：spec 附录 G R1 + Task 13.4
  - 红线：hidden 仍喂全包 → token 没省

---

## 审查流程

1. 你把 Cursor 的产出（SP 改后文本 / 代码 diff / 它的自述）发我
2. 我按本清单 5 类 25 项逐条标 ✅/❌/⚠️
3. ❌ 项给出"为什么不对 + 该怎么改 + 依据哪份文档"
4. ⚠️ 项标"需 Cursor 补信息"
5. 全 ✅ 才放行进下一阶段

## 我需要你转给 Cursor 的信息（见配套提问提示词）

当某项我判断不了时，我会让你问 Cursor 具体问题（见 [cursor-questions-for-trae-review.md](file:///Users/mac/Desktop/育见-2/.trae/documents/cursor-questions-for-trae-review.md)）。
