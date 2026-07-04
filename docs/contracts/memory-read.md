# 读取契约 — daily AI 回复前可读的记忆层

> 检索路由：`src/lib/server/memory/retrieval/router.ts` `buildDailyDialogueRetrievalPacket`
> 上下文打包：`src/lib/server/daily/prose-context.ts` `buildDailyProsePayload`

## daily AI 回复前可读层

| 记忆层 | 读取函数 | 进入 retrievalPacket 字段 | 进入 prose retrievalPack 字段 | 前端 AI 真读？ |
|---|---|---|---|---|
| turn_events | getMergedParentInputHistory | recentRelatedEvents | recentEvents | ✅ |
| daily_updates | getDailyInteractionUpdates | recentRelatedEvents（合并） | recentEvents | ✅（仅 newInput） |
| entry_evidence_packs | getEntryEvidencePacks | supportingEvidence（episode 摘要，非直接） | entryEvidence | ⚠️ **不读 verifiableFacts**（断点，Batch 3 修） |
| built_profile_snapshots | getLatestBuiltProfileSnapshot | relevantChildStructureModels（fallback） | childStructureModels | ✅ |
| conditional_profiles | getConditionalProfiles | relevantChildStructureModels | childStructureModels | ✅（childTendency） |
| pending_hypotheses | getPendingHypotheses | pendingHypotheses | pendingHypotheses | ✅ |
| evidence_networks | getLatestEvidenceNetwork | matchedMechanisms | matchedMechanisms | ❌ **===high 阈值过严，永远空**（Batch 3 修） |
| family_interaction_cycles | getFamilyInteractionCycles | familyInteractionPatterns | familyPatterns | ✅ |
| parent_narrative_patterns | getParentNarrativePattern | parentNarrativePattern | parentUnderstanding | ❌ **dead write，永远 null**（Batch 4 修） |
| evidence_episodes/fact_atoms | retrieveContextPack（向量） | recentRelatedEvents/supportingEvidence | - | ✅（仅非 warmTurn） |
| childQuotes（entry packs 子字段） | packs.flatMap childQuotes | childQuotes | childQuotes | ❌ **永远空**（Batch 5 砍） |

## 前端 AI vs 后端思考 agent 读取区分（原则）

### 前端 AI（daily/rehearsal）只读不思考

直读后端整理好的结构化字段，不再自己推断机制（省钱）：
- 具体事实：`verifiableFacts` / `childBehaviors` / `triggerPoints`（Batch 3 新增 direct-feed `entryFacts`）
- 深度机制：`candidateMechanismMatrix` 的 mechanismName + overallStrength
- 画像：`conditional_profiles` childTendency + built_profile_snapshot fallback
- 假设：`pending_hypotheses`
- 互动模式：`family_interaction_cycles`
- 家长叙事：`parent_narrative_patterns`（Batch 4 通后）
- 近期事件：`turn_events` + `daily_updates` newInput

### 后端思考 agent 读全量 + 调 LLM 产出

- `deep_mechanism_review`（Batch 4 新）：读全量 packs + updates + network + hypotheses + cycles → LLM 思考 → 产 evidence_networks（覆盖）+ pending_hypotheses + parent_narrative_patterns
- `synthesis`：读全量 packs → 产 candidateMechanismMatrix + childStructureModelDraft（build 链）
- `diagnosis`：读 packs + network → 产 conditional_profiles + family_interaction_cycles + pending_hypotheses
- `model_review`：读 pending_hypotheses → 复核置信度
- `entry_evidence`：读 raw → LLM 拆解 → 产 entry_evidence_packs decomposedInput

## 每写入层必须有读取路径（dead write 禁止）

见 memory-write.md「谁写谁读」表。本契约要求：任何新增写入字段必须同时声明读取路径，否则不允许写入。

## 验证

- retrieval packet test：daily_updates+turn_events 进 recentEvents；built_profile_snapshot fallback childStructureModels；entryFacts 非空（Batch 3 后）
- 真实跑动：新注册账号走四模块后交流，DB 查 turn_event.retrievedContextSnapshot 有 entryFacts + matchedMechanisms 非空
