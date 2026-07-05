# 记忆写入契约

> 入口：`app/api/daily/stream/route.ts`
> 写入引擎：`src/lib/server/memory/write/decision-engine.ts`
> job 队列：`src/lib/server/jobs/queue.ts`

## 三层写入 + gate

| 层 | 何时不写 | 何时写 | 谁写 | 谁读 | job |
|---|---|---|---|---|---|
| `turn_events` | 无 | **每轮 final 后总写**（含 safety/insufficient） | route.ts saveTurnEvent | router getMergedParentInputHistory；memory-status | 同步 |
| `daily_updates` | safety / insufficient / light_response 且原文<12字 | 其余有机制信号/反证/明确场景 | createDailyUpdate → memory_write | router getDailyInteractionUpdates | memory_write |
| `episode_ingest` | 普通轮 | **仅 counter_evidence** | route enqueueJob | router retrieveContextPack | episode_ingest |

## 谁写谁读（每层必须有读取路径）

| 写入层 | 读取路径 | 状态 |
|---|---|---|
| turn_events | getMergedParentInputHistory → recentEvents | ✅ |
| daily_updates | getDailyInteractionUpdates → recentEvents | ✅ |
| entry_evidence_packs | getEntryEvidencePacks → entryFacts + supportingEvidence | ✅ |
| evidence_networks | getLatestEvidenceNetwork → matchedMechanisms（≠low） | ✅ |
| conditional_profiles | getConditionalProfiles → childStructureModels | ✅ |
| pending_hypotheses | getPendingHypotheses | ✅ |
| family_interaction_cycles | getFamilyInteractionCycles → familyPatterns | ✅ |
| built_profile_snapshots | getLatestBuiltProfileSnapshot → fallback 画像 | ✅ |
| parent_narrative_patterns | getParentNarrativePattern → parentUnderstanding | ✅（memory_write + deep_mechanism_review） |
| raw_materials / cleaned_facts / retrieval_indexes | router 从不读 | ❌ 死层（CHILDOS_WRITE_DEAD_LAYERS 默认停写） |

## job 链（queue.ts runJob）

```
memory_write → digest_update(每日桶) + model_review(每日桶,有假设时)
entry_evidence → digest_update + model_review
forceLoginJobCheck → 重投 failed + digest_update + model_review
memory_write → deep_mechanism_review(每日桶)
四模块完成 → 立即 deep_mechanism_review（不等桶）
```

## 不写长期记忆的轮次

- safety（只记 turn_event）
- insufficient（只记 turn_event）
- light_response 且原文<12字（短寒暄，只记 turn_event）

## 验证

```bash
npm run test:contracts
node scripts/audit-memory-contract.mjs
```

- memory gate：短寒暄不 enqueue memory_write；counter_evidence enqueue episode_ingest
- job health：enqueue 后 job_queue 有 trace_id；memory-status 按 traceId 可查
