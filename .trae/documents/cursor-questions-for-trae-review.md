# 给 Cursor 的提问提示词（Trae 检察官用）

> 用法：你是用户，把下面这些问题发给 Cursor。Cursor 回答后，把回答贴给我（Trae），我按 [cursor-sp-review-checklist.md](file:///Users/mac/Desktop/育见-2/.trae/documents/cursor-sp-review-checklist.md) 逐条审查。
> 问题按 5 类风险分组，每组先问"做没做"，再问"具体是什么"。答不清的就是风险点。

---

## 提问开场（先发给 Cursor 这段）

```
你在修 SP 和重链路。我是你的审查方，需要你回答以下问题，答不清的就说"没做/没看"，不要编。
回答要具体到文件名、字段名、行号，不要泛泛说"已对齐"。
```

---

## 风险 1 · 照搬旧链路（v3 链路对齐）

```
1.1 你改的每个 SP/代码里，引用的是 dossier v3 字段（dossierSlice/workingHypothesis/integratedSynthesis/interventionTargets）还是仍写 matchedMechanisms/mechanismNarrative？贴 3 处具体改动 diff。

1.2 portraitSynthesizer 是在 deep_mechanism_review Job 内取代 mechanismSynthesizer，还是新建了独立 Job？贴 pipeline.ts 改动行。

1.3 dossier_patch 是挂在 memory_write 链尾（executeWritePlan 后非反证轮），还是新建了定时器/独立触发源？贴 decision-engine.ts 或 queue.ts 改动。

1.4 shouldReconceptualize 是并入 runDeepMechanismReview 入口（pipeline.ts:316），还是另开了判定函数？贴代码。
```

---

## 风险 2 · SP 输出内容反推（防便条骨架）

```
2.1 portraitSynthesizer SP 里，是否列了 7 段输出结构（familyStruct/fivePs/sceneReadings/parentPerspectives/workingHypothesis/interventionTargets+obstacle/ecologicalCalibration+integratedSynthesis+alternativeReadings）？贴 SP 正文标题段。

2.2 每段是否写了字段要求——每因素带 confidence(0-1含跨场景备注) + evidenceSummary(人话+来源模块标签)？贴 SP 里 fivePs 段的格式说明。

2.3 workingHypothesis SP 是否要求 ≥2 条可证伪 predictions + 失败触发重概念化？贴 SP 原文。

2.4 dossierPatcher SP 是否要求"仅改受影响段落 + 不推翻 workingHypothesis 核心 + changeLog"？贴 SP 原文。

2.5 前台 SP 是否解决"要方法就沉默"——区分"要方法"与"信息不够"、advice section 放宽到 150-250 字允许 1-2 靶点带 prediction+obstacle、ask_advice 轮 prose 可含一个靶点 action？贴 parentFacingStyle 和 parentFacingCopy 改动。orchestration 是否加了 advice_from_dossier 新枚举区分"要解释"与"要方法"？
```

---

## 风险 3 · 契约/整链对齐

```
3.1 你读过 docs/contracts/read-contract.md 厚包 10 字段 + slice 上限吗？matchedMechanisms 双 slice（router.ts:245 的 20 与 frontend-read-pack.ts:82 的 40）是否统一为 8？贴改动。

3.2 packages/contracts/src/daily-stream.ts 的 DailyStreamEvent/DailySection/DailyAction 形态你改了吗？如果改了，说明小程序 miniprogram/src/services/dailyStream.ts 是否需要同步改。

3.3 dossierSlice 加到 pickFrontendReadPack 的 FRONTEND_READ_PACK_KEYS 后，buildDailyDialogueRetrievalPacket 是否填充了 dossierSlice？两个文件都贴改动。

3.4 你新增的每个 dossier 字段，是否在 spec 附录 B 字段流转表里有 producer/storage/consumer？列出你新增的字段及其写入方和接收方。
```

---

## 风险 4 · 数据库真实数据（防臆想）

```
4.1 你拉过生产库 memory_layer_items 的真实聚合结构吗（按 layer_name 计数、场景分布、证据类型分布，不拉原始文本）？如果拉过，贴最丰富家庭的 layer 分布。如果没拉，说明你凭什么判断 familyStruct/fivePs 能填进真实数据。

4.2 familyStruct/fivePs/sceneReadings 的 evidenceSummary 引用的"来源模块标签"（作业模块/日常模块/妈妈原话等），对应 memory_layer_items 的哪些 layer_name？列对照表。如果对不上，说明你臆想了哪些。

4.3 deep_model_digest 层 schema v2（item_id=dossier_v{n} + latest + schemaVersion）在 db.ts schema 里加了没？贴 schema 改动。

4.4 shouldReconceptualize 的判定条件"反证≥2""同主题≥3次"，查的是 memory_layer_items 的哪个 layer_name？turn_events 和 user_tasks 表里有哪些字段支持"同主题"判定？如果字段不存在，说明你打算怎么实现。
```

---

## 风险 5 · 中间层 Agent 断层（防便签传话）

```
5.1 ecosystemClassifier 的输入是什么（几条事实）？输出 ecosystemMap 被 theoryMatcher 消费了吗？贴两个 Agent 的输入输出契约。

5.2 theoryMatcher 输入含完整 THEORY_CARDS（15张×9字段）吗？它的输出 theoryCardId 进了 portraitSynthesizer 吗——还是只作内部透镜不进输出 schema？贴 portraitSynthesizer 的输入定义。

5.3 portraitSynthesizer 的输入是否含"旧 dossier（作前一版假设）"？如果不含，重概念化时怎么写"相比上一版变化"的 changeLog？贴输入定义。

5.4 dossierPatcher 的输入是否含"现有 dossier + 本批新事实"？如果只给新事实不给旧 dossier，它怎么知道改哪段？贴输入定义。

5.5 structuralRiskExtractor 在 v3 链里仍被调用吗？输出进 digest 吗？贴 pipeline.ts 调用链。

5.6 digestBuilder（确定性拼）是改为从 dossier 投影（integratedSynthesis + familyStruct 摘要），还是仍取 topMechanism.description？贴 digest-builder.ts 改动。

5.7 前台 parent-facing-copy.ts 的 hidden 调用，payload 是否改薄（只带 dossierSlice + 该 hidden section skeleton，不带完整 retrievalPack）？贴 payload 构造改动。
```

---

## 收尾提问（强制）

```
最后，请自检：
- 你改的每个 SP，是否符合 .cursor/rules/sp-content-depth.mdc「SP 不能是便条骨架」？挑一个你改过的 SP，贴全文，说明它哪里不是便条。
- 你改的每个字段，是否符合 .cursor/rules/ai-product-engineering.mdc「producer/storage/consumer 明确」？挑一个新增字段说明。
- 你改完跑过 npm run typecheck + npm run lint 了吗？贴结果。
```

---

## 我（Trae）的判断方式

你把 Cursor 的回答贴给我，我会：
1. 逐条对照 [cursor-sp-review-checklist.md](file:///Users/mac/Desktop/育见-2/.trae/documents/cursor-sp-review-checklist.md) 的 25 项打 ✅/❌/⚠️
2. ❌ 项给出"为什么不对 + 该怎么改 + 依据"
3. ⚠️ 项（Cursor 答不清）标"需补信息"
4. 若风险 4（数据库）Cursor 全答"没拉"，我会建议你先让它跑 Task 0 真实数据校验，再继续改
5. 若风险 5（中间层断层）有多项 ❌，我会建议你让它先画"每个 Agent 的输入输出契约表"再改 SP

**关键**：如果 Cursor 答得含糊（"已对齐""已考虑"但不贴具体 diff/字段），那就是风险信号，我会让你追问"贴 diff"。
