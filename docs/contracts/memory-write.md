# 记忆写入契约

> 入口：`app/api/daily/stream/route.ts:106-155`
> 写入引擎：`src/lib/server/memory/write/decision-engine.ts`
> job 队列：`src/lib/server/jobs/queue.ts`

## 三层写入 + gate

| 层 | 何时不写 | 何时写 | 谁写 | 谁读 | job |
|---|---|---|---|---|---|
| `turn_events` | 无 | **每轮 final 后总写**（含 safety/insufficient） | route.ts:106 saveTurnEvent | router.ts:119 getMergedParentInputHistory；memory-status 审计 | 同步（无 job） |
| `daily_updates` | safety / insufficient / light_response 且原文<12字 | 其余有机制信号/反证/明确场景 | route.ts:128 createDailyUpdate → memory_write job | router.ts:98 getDailyInteractionUpdates（recentEvents） | memory_write |
| `episode_ingest` | 普通轮 | **仅 counter_evidence**（反证高价值） | route.ts:151 enqueueJob | router.ts:131 retrieveContextPack（向量语义检索） | episode_ingest |

## 谁写谁读（每层必须有读取路径，否则 dead write）

| 写入层 | 读取路径 | 状态 |
|---|---|---|
| turn_events | getMergedParentInputHistory → recentEvents | ✅ 通 |
| daily_updates | getDailyInteractionUpdates → recentEvents | ✅ 通 |
| entry_evidence_packs | getEntryEvidencePacks → buildParentUnderstanding + synthesis | ✅ 通 |
| evidence_networks | getLatestEvidenceNetwork → matchedMechanisms | ✅ 通（但 matchedMechanisms===high 阈值过严，Batch 3 改） |
| conditional_profiles | getConditionalProfiles → relevantChildStructureModels | ✅ 通 |
| pending_hypotheses | getPendingHypotheses → pendingHypotheses | ✅ 通 |
| family_interaction_cycles | getFamilyInteractionCycles → familyInteractionPatterns | ✅ 通 |
| built_profile_snapshots | getLatestBuiltProfileSnapshot → fallback 画像 | ✅ 通 |
| parent_narrative_patterns | getParentNarrativePattern → buildParentUnderstanding | ❌ **dead write**（decision-engine.ts:186 永远 []）→ Batch 4 deep_mechanism 修复 |
| raw_materials / cleaned_facts / retrieval_indexes | router 从不读 | ❌ **死层**（已用 CHILDOS_WRITE_DEAD_LAYERS 默认停写） |

## job 链（queue.ts runJob）

```
memory_write → digest_update(每日桶) + model_review(每日桶,有假设时)
entry_evidence → digest_update + model_review
forceLoginJobCheck → 重投 failed + digest_update + model_review
[Batch 4 新增] memory_write → deep_mechanism_review(每日桶)
[Batch 4 新增] 四模块完成 → 立即 deep_mechanism_review（不等桶）
```

## 不写长期记忆的轮次

- safety（安全风险，只记 turn_event）
- insufficient（信息不足，只记 turn_event）
- light_response 且原文<12字（短寒暄，只记 turn_event）

## 验证

- memory gate test：短寒暄不 enqueue memory_write；有效观察 enqueue；counter_evidence enqueue episode_ingest
- job health test：enqueue 后 job_queue 有 trace_id；memory-status 按 traceId 查到
