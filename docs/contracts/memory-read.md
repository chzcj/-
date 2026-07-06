# 读取契约 — daily AI 回复前可读的记忆层

> 检索路由：`src/lib/server/memory/retrieval/router.ts` `buildDailyDialogueRetrievalPacket`
> 上下文打包：`src/lib/server/daily/prose-context.ts` → `pickFrontendReadPack()`（[frontend-read-pack.ts](../../src/lib/server/daily/frontend-read-pack.ts)）
> 前端只读子集定义：[read-contract.md](./read-contract.md) · 互动模式阶段：[family-interaction-stages.md](./family-interaction-stages.md)

## daily AI 回复前可读层

| 记忆层 | 读取函数 | 进入 retrievalPacket 字段 | 进入 prose retrievalPack 字段 | 前端 AI 真读？ |
|---|---|---|---|---|
| turn_events | getMergedParentInputHistory | recentRelatedEvents | recentEvents | ✅ |
| daily_updates | getDailyInteractionUpdates | recentRelatedEvents（合并） | recentEvents | ✅（newInput 入 recentEvents） |
| entry_evidence_packs | getEntryEvidencePacks | supportingEvidence（摘要）+ **entryFacts**（直喂） | entryEvidence + entryFacts | ✅ |
| built_profile_snapshots | getLatestBuiltProfileSnapshot | relevantChildStructureModels（fallback） | childStructureModels | ✅ |
| conditional_profiles | getConditionalProfiles | relevantChildStructureModels | childStructureModels | ✅（`.childTendency` 字符串） |
| pending_hypotheses | getPendingHypotheses | pendingHypotheses | pendingHypotheses | ✅ |
| evidence_networks | getLatestEvidenceNetwork | matchedMechanisms（`overallStrength !== 'low'`） | matchedMechanisms | ✅ |
| family_interaction_cycles | getFamilyInteractionCycles | familyInteractionPatterns | familyPatterns | ✅ |
| parent_narrative_patterns | getParentNarrativePattern | parentNarrativePattern → flatten | parentUnderstanding | ✅（deep_mechanism_review + memory_write 写入） |
| evidence_episodes/fact_atoms | retrieveContextPack（向量） | recentRelatedEvents / supportingEvidence | recentEvents（间接） | ✅（非 warmTurn） |
| childQuotes | turn_events / evidence_networks | childQuotes（孩子原话片段） | childQuotes | ✅ |
| parentVerbatimSnippets | turn_events / entry packs | parentVerbatimSnippets | parentVerbatimSnippets | ✅ |
| deep_model_digest | loadDeepModelDigest | — | deepModelDigest（含 structuralTensions 家庭运转张力） | ✅ |

## 前端 AI vs 后端思考 agent 读取区分（原则）

### 前端 AI（daily/rehearsal）只读不思考

直读 `pickFrontendReadPack()` 产出的 `string[]` 子集，不再自己推断机制：
- 具体事实：`entryFacts`（verifiableFacts / childBehaviors / triggerPoints 合并去重）
- 深度机制：`matchedMechanisms`（机制名，非 low 强度）
- 画像：`childStructureModels`（conditional_profiles.childTendency + built_snapshot fallback）
- 假设：`pendingHypotheses`
- 互动模式：`familyPatterns`（L7 cycles 拼接）
- 家长叙事：`parentUnderstanding`（parent_narrative_patterns flatten）
- 近期事件：`recentEvents`

### 后端思考 agent 读全量 + 调 LLM 产出

- `deep_mechanism_review`（多 Agent 链：ecosystem → theory → synthesize → structuralRisk）：读全量 packs → 覆盖 evidence_networks、写 handoffs + structuralTensions 入 digest
- `synthesis`：读全量 packs → candidateMechanismMatrix + childStructureModelDraft
- `diagnosis`：读 packs + network → conditional_profiles + family_interaction_cycles
- `model_review`：复核 pending_hypotheses
- `entry_evidence`：raw → entry_evidence_packs decomposedInput

## 每写入层必须有读取路径（dead write 禁止）

见 [memory-write.md](./memory-write.md)。任何新增写入字段必须同时声明读取路径。

## 验证

```bash
npm run test:contracts          # 含 FrontendReadSchema 门控
node scripts/test-retrieval-packet.mjs
npm run audit:memory            # 可选：带 SSH_PASS 的线上 DB + 召回探测
```

- 静态：`test-retrieval-packet.mjs` 断言 router 建 entryFacts、matchedMechanisms 阈值、prose 经 pickFrontendReadPack
- 真实跑动：新账号四模块后交流，turn_event.retrievedContextSnapshot 含 entryFacts；有 network 时 matchedMechanisms 非空
