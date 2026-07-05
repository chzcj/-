# 读取契约：前端 AI vs 后端思考 Agent

## 核心原则

前端 AI（daily prose/section LLM，面向家长）**只读不思考**：直读具体事实 + 深度机制名 + 画像文本，不读全量原始层、不重复推理。
后端思考 Agent（deep_mechanism_review / synthesis / diagnosis）**读全量 + 调 LLM 产出**：读所有记忆层，产出结构化机制/假设/画像。

## 前端 AI 读取字段集（FrontendReadSchema）

实现：`src/lib/server/daily/frontend-read-pack.ts` 的 `pickFrontendReadPack()`。

`buildDailyProsePayload`（[prose-context.ts](../../src/lib/server/daily/prose-context.ts)）构造的 `retrievalPack` 是前端 AI 的**唯一**上下文来源，只含以下子字段：

| 字段 | 来源 | 含义 | 必读 |
|------|------|------|------|
| `childStructureModels` | built_profile_snapshots.coreJudgment / ConditionalProfile.childTendency | 画像文本（人话） | ✓ |
| `entryEvidence` | entry_evidence_packs（slice 4） | 四模块采集包摘要 | ✓ |
| `entryFacts` | entry_evidence_packs.decomposedInput 的 verifiableFacts+childBehaviors+triggerPoints 合并去重 slice 6 | **具体事实直喂**（如"错题本只抄答案"） | ✓ 必留 |
| `matchedMechanisms` | evidence_networks.candidateMechanismMatrix（overallStrength !== 'low'）机制名 slice 3 | **深度机制直读** | ✓ 必留 |
| `familyPatterns` | L7 FamilyInteractionCycle 拼 cycleName:parentTriggerAction:childReaction slice 4 | 家庭互动模式 | ✓ |
| `parentUnderstanding` | parent_narrative_patterns flatten slice 6 | 家长叙事模式 | ✓ |
| `recentEvents` | turn_events + daily_updates 合并最近 5 条 | 近期对话 | 动态 |
| `pendingHypotheses` | pending_hypotheses slice 3 | 待验证假设 | 动态 |

**前端 AI 禁止读**：raw_materials、cleaned_facts、retrieval_indexes、evidence_networks 全量对象（只读机制名）、diagnosis 全量、synthesis 全量。

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

- **机制层**（evidence_networks.candidateMechanismMatrix）：synthesis 首次写草案，deep_mechanism 覆盖为深度机制。retrieval 统一从 evidence_networks 读机制名 → 前端 matchedMechanisms。
- **画像层**（built_profile_snapshots）：synthesis 写 coreJudgment/deepMechanism；deep_mechanism 跑完同步刷新 deepMechanism，保持与机制层一致。
- **互动模式层**（L7 FamilyInteractionCycle）：唯一真源。多阶段字段对照见 [family-interaction-stages.md](./family-interaction-stages.md)。retrieval 从 L7 cycles 拼 familyPatterns。

## 条件画像两阶段（非冗余）

- 草案态：`SynthesisOutput.childStructureModelDraft.primaryConditionalProfile: string`（120-200 字文本草案，给 diagnosis handoff）
- 成型态：`ChildStructureModel.primaryConditionalProfile: ConditionalProfile | null`（结构化对象，落 L5 层）
- 读取统一：所有读取处取 `.childTendency` 字符串（如 [profile-rewrite.ts](../../src/lib/server/profile-rewrite.ts)、[router.ts](../../src/lib/server/memory/retrieval/router.ts)），禁止把对象塞进 LLM material。
