# 读取契约：前端 AI vs 后端思考 Agent

## 核心原则

前端 AI（daily prose/section LLM，面向家长）**只读不思考**：直读具体事实 + 深度机制人话卡 + 画像文本，不读全量原始层、不重复推理。
后端思考 Agent（deep_mechanism_review / synthesis / diagnosis）**读全量 + 调 LLM 产出**：读所有记忆层，产出结构化机制/假设/画像。

## 双路径（厚包默认开）

环境变量 `FAMILY_MEMORY_THICK_PACK`：

| 值 | 行为 |
|----|------|
| 缺省 / `1` / `on` / `true` | **厚包**（一批默认）：dossierSlice 主源、机制人话卡兜底≤8、事实≤80、digest 含结构张力 |
| `0` / `off` / `false` / `thin` | **薄包回退**：旧 slice（机制名≤3、事实≤6） |

实现：`isThickFamilyMemoryPack()` / `getFrontendReadSliceLimits()`（[frontend-read-pack.ts](../../src/lib/server/daily/frontend-read-pack.ts)）。

## 前端 AI 读取字段集（FrontendReadSchema）

实现：`src/lib/server/daily/frontend-read-pack.ts` 的 `pickFrontendReadPack()`。

`buildDailyProsePayload`（[prose-context.ts](../../src/lib/server/daily/prose-context.ts)）构造的 `retrievalPack` 是前端 AI 的**唯一**检索上下文来源，只含以下子字段（另可选 `deepModelDigest`）：

| 字段 | 来源 | 含义 | 厚包上限 | 薄包上限 |
|------|------|------|---------|---------|
| `childStructureModels` | built_profile_snapshots.coreJudgment / ConditionalProfile.childTendency | 画像文本（人话） | 12 | 4 |
| `entryEvidence` | entry_evidence_packs | 四模块采集包摘要 | 12 | 4 |
| `entryFacts` | entry_evidence_packs.decomposedInput 的 verifiableFacts+childBehaviors+triggerPoints | **具体事实直喂** | 80 | 6 |
| `dossierSlice` | deep_model_digest.dossier → dossier-slicer（按 query 切） | **v3 主源** | 24 | 8 |
| `matchedMechanisms` | evidence_networks → formatMatchedMechanismCards（兜底） | dossier 缺失时 | **8** | 3（仅名） |
| `familyPatterns` | L7 FamilyInteractionCycle | 家庭互动模式 | 10 | 2 |
| `parentUnderstanding` | parent_narrative_patterns flatten | 家长叙事模式 | 12 | 6 |
| `recentEvents` | turn_events + daily_updates | 近期对话 | 12 | 5 |
| `pendingHypotheses` | pending_hypotheses | 待验证假设 | 10 | 3 |
| `childQuotes` | turn_events / evidence_networks | 孩子原话 | 16 | 4 |
| `parentVerbatimSnippets` | turn_events | 家长原话 | 16 | 4 |
| `deepModelDigest` | deep_model_digest 层 | SecondMe 家长向摘要（机制叙事+锚定事实+**structuralTensions**） | 见 pick | 见 pick |

**注入面（一批已接线）**：daily prose / visible+hidden section、how-to-speak、rehearsal analyze。均走同一厚包/digest pick。

**前端 AI 禁止读**：raw_materials、cleaned_facts、retrieval_indexes、evidence_networks 全量对象、diagnosis 全量、synthesis 全量。家长可见文案禁止理论卡名。

## 后端思考 Agent 读取字段集（BackendReadSchema）

`runDeepMechanismReview`（[reviewer.ts](../../src/lib/server/memory/deep-mechanism/reviewer.ts)）读全量：

- entry_evidence_packs（全量 decomposedInput）
- turn_events + daily_updates（最近 100 条）
- evidence_networks.candidateMechanismMatrix（全量结构化）
- pending_hypotheses（全量）
- built_profile_snapshots（coreJudgment + deepMechanism）
- family_interaction_cycles（全量）
- parent_narrative_patterns（全量）

后端 Agent 产出写回：evidence_networks（覆盖机制层）、pending_hypotheses（合并）、parent_narrative_patterns、built_profile_snapshots.deepMechanism（同步刷新）。

## share-layer 策略

- **机制层**（evidence_networks.candidateMechanismMatrix）：synthesis 首次写草案，deep_mechanism 覆盖为深度机制。retrieval 经 `formatMatchedMechanismCards` → 前端 matchedMechanisms。
- **画像层**（built_profile_snapshots）：synthesis 写 coreJudgment/deepMechanism；deep_mechanism 跑完同步刷新 deepMechanism，保持与机制层一致。
- **互动模式层**（L7 FamilyInteractionCycle）：唯一真源。多阶段字段对照见 [family-interaction-stages.md](./family-interaction-stages.md)。retrieval 从 L7 cycles 拼 familyPatterns。

## S2：机制加厚触发（正交幂等键）

环境变量 `DEEP_MECHANISM_S2`（默认开；`0/off/false` 回退）：

| 路径 | idempotency key | 触发点 |
|------|-----------------|--------|
| memory_write 日桶 | `deep_mechanism:{fam}:{child}:{day}` | L1 记忆写入链式 |
| 每日打开 | `deep_mechanism:daily_open:{fam}:{child}:{day}` | `POST /api/account/daily-refresh` → `forceLoginJobCheck` |
| 每 10 有效轮 | `deep_mechanism:turn:{fam}:{child}:{milestone}` | daily `shouldWriteL1` + 预演 `recordFeatureTurn` |
| 四模块完成 | `deep_mechanism:build:…` | `profile/built` / `entry/analyze` final |

有效轮定义：交流 L1 写入成功轮 + 预演（含冲突复盘）成功轮。三条路径**不互跳过**。

交流 tip：`GET/POST /api/daily/mechanism-tip`（文案「对你家的理解又加深了一点」），仅在 `runDeepMechanismReview` 实际写回后标记。

## S3：建档完成度 + 动态 Summary

| Flag | 默认 | 行为 |
|------|------|------|
| `BUILD_COMPLETENESS_V2` | 开 | 信息不足模块不计满格；假 100 修复；hub/built 服务端纠偏 |
| `ONBOARDING_ENTRY_SUMMARY_S3` | 开 | Summary 要 familyMap / sections / sufficient |

完成度实现：`src/lib/build/completeness.ts`。无效模块确认后仍可继续（不卡流程），但完整度不会到 100。

## 条件画像两阶段（非冗余）

- 草案态：`SynthesisOutput.childStructureModelDraft.primaryConditionalProfile: string`（120-200 字文本草案，给 diagnosis handoff）
- 成型态：`ChildStructureModel.primaryConditionalProfile: ConditionalProfile | null`（结构化对象，落 L5 层）
- 读取统一：所有读取处取 `.childTendency` 字符串（如 [profile-rewrite.ts](../../src/lib/server/profile-rewrite.ts)、[router.ts](../../src/lib/server/memory/retrieval/router.ts)），禁止把对象塞进 LLM material。
