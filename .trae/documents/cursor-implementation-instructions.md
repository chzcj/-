# 给 Cursor 的逐行级实施指令（Trae 检察官出）

> 用法：把本文件发给 Cursor。Trae 已完成文档+SP 部分（P1-6/P1-7/P0-4 SP），Cursor 负责核心代码（P0-1/P0-2/P0-3/P1-5/P1-8/P2-9）。
> 上下文：Trae 持有完整 v3 spec + 25 项审查判定 + 修复 spec，本指令把上下文优势转化为 Cursor 的执行精度。

---

## Trae 已完成（不要再改）

- `docs/contracts/read-contract.md` L14/L29（机制人话卡≤20→8、entryFacts 40→80）
- `prompts/background/portraitSynthesizer.md` fivePs 段补跨场景备注模板 + 8 标签↔layer_name 映射表（L55-74）
- spec 三件套：`.trae/specs/fix-v3-implementation-gaps/{spec,tasks,checklist}.md`

---

## Cursor 必做（按 P0→P1→P2 顺序）

### P0-3 · Task 0 真实数据拉取（最先做，其他 P0 依赖）

**问题**：上次连接生产库 `password authentication failed` /本地 `ECONNREFUSED`。

**步骤**：
1. SSH 到服务器跑只读 psql（不拉原始文本，仅聚合）：
```bash
sshpass -p 'Afei530268' ssh -o StrictHostKeyChecking=no ubuntu@81.70.228.8 "cd ~/yujian && PGPASSWORD=\$(grep -oP '(?<=childos:)[^@]+' .env.local | head -1) psql -h 127.0.0.1 -U childos -d childos -t -c \"
SELECT tenant_id, layer_name, COUNT(*) FROM memory_layer_items GROUP BY tenant_id, layer_name ORDER BY tenant_id, layer_name;
\""
```
2. 若仍 password failed，先核对 `.env.local` 里 DATABASE_URL 的用户名/密码/库名是否匹配实际 PG：
```bash
sshpass -p 'Afei530268' ssh ubuntu@81.70.228.8 "cd ~/yujian && grep -oE '^DATABASE_URL=postgres[^@]*@[^:/]+' .env.local"
```
3. 拉到数据后，验证 `daily_updates.classification=counter_evidence` 字段真实存在：
```sql
SELECT COUNT(*) FROM memory_layer_items WHERE layer_name='daily_updates' AND (data->>'classification')='counter_evidence';
```
4. 写入 `/Users/mac/Desktop/育见-2/.trae/documents/portrait-real-data-validation.md`：layer_name 分布 + counter_evidence 是否有数据 + 验证 portraitSynthesizer SP 的 8 标签映射表 layer_name 列是否真实存在。

**给 Trae 的回报**：贴 SQL 输出 + portrait-real-data-validation.md 内容。Trae 据此校准 SP 映射表 layer_name 列。

---

### P0-1 · 接 prediction 失败 → L2 重概念化

**逐文件改动**：

**1. `src/types/deep-model-digest.ts`**（或 dossier 类型定义处）：
- `workingHypothesis.predictions[]` 每条加 `status: 'unverified' | 'failed' | 'verified'` 字段，默认 `unverified`。

**2. `src/types/database.ts`**（UserTask 类型）：
- 加 `linkedPredictionId?: string` 字段（任务关联 prediction id，如 `pred_1`）。

**3. `src/lib/server/tasks/task-service.ts`**（任务 feedback 处理）：
- `applyUserTaskFeedback` 里，若 feedback 标记「未达预期」且 task 有 `linkedPredictionId`：
  - 读当前 dossier 的 `workingHypothesis.predictions`，把对应 id 的 status 设为 `failed`
  - `saveDossierVersion` 写回（**版本号+1，不覆盖旧版**，changeLog 记「pred_X 标记 failed：任务 T 未达预期」）
  - 触发 `enqueueJob('deep_mechanism_review', { tenant }, deepMechanismBucketKey(tenant) + ':pred_failed:' + predId, traceId)`

**4. `src/lib/server/memory/dossier/should-reconceptualize.ts`**：
- 加 `checkPredictionFailure(tenant)`：
```typescript
async function checkPredictionFailure(tenant: string) {
  const dossier = await getLatestDossier(tenant)
  if (!dossier?.workingHypothesis?.predictions) return null
  const failed = dossier.workingHypothesis.predictions.find(p => p.status === 'failed')
  if (failed) return { should: true, reason: 'prediction_failed' as const, failedPredictionId: failed.id }
  return null
}
```
- 在主 `shouldReconceptualize` 函数里，**优先于**其他判定调用 `checkPredictionFailure`，命中即返回。

**5. `src/lib/server/memory/deep-mechanism/pipeline.ts`**（portraitSynthesizer 调用处，约 L514-527）：
- `shouldReconceptualize` 返回 `reason: 'prediction_failed'` 时，把 `failedPredictions: [{ id, text }]` 加入 portraitSynthesizer 调用入参：
```typescript
const failedPredictions = recon.reason === 'prediction_failed' 
  ? (await getLatestDossier(tenant))?.workingHypothesis.predictions.filter(p => p.status === 'failed') 
  : []
callDeepAgentJson('portraitSynthesizer', ..., { ...sharedContext, ecosystemMap, theoryMatches, previousDossier, failedPredictions })
```

**6. `prompts/background/portraitSynthesizer.md`**（Trae 已改 fivePs，Cursor 补 failedPredictions 段）：
- 在「Level 1 vs Level 2」段后加：
```markdown
### failedPredictions 非空时（L2 触发于 prediction 失败）
- changeLog 必显式说明「prediction X 失败 → 调整 Y」
- 对应 protective/perpetuating 的 confidence 必须降（如 PR_t1 0.72→0.55）
- 若 prediction 失败说明主假设错了，workingHypothesis.text 必须重写，不能只调 confidence
```

**7. 反证≥2 联动**（`should-reconceptualize.ts`）：
- 现有 `counter_evidence` 判定命中时，也把对应 protective 关联的 predictions 标记 `failed`（需 dossier 里 interventionTargets 有 `targets` 指向 protective，反证针对该 protective → 对应 prediction failed）。

**给 Trae 的回报**：贴 should-reconceptualize.ts diff + pipeline.ts L514-527 diff + portraitSynthesizer.md failedPredictions 段。Trae 审 prediction 失败是否真接通（不是 SP 写了就算）。

---

### P0-2 · 修 intervention_failed 真实监测（废弃关键词 regex）

**逐文件改动**：

**1. `src/lib/server/memory/dossier/should-reconceptualize.ts`**：
- **删除**现有 `/拖|作业|手机|顶嘴|沉默/` regex 路径（intervention_failed 那段）。
- 加 `checkInterventionFailed(tenant)`：
```typescript
async function checkInterventionFailed(tenant: string) {
  // 1. 近 14 天 user_tasks feedback=未达预期 或 status=completed_but_unsatisfied
  const failedTasks = await getRecentFailedTasks(tenant, 14) // 新函数，读 user_tasks
  if (failedTasks.length === 0) return null
  // 2. 近 30 条 turn_events 按主题聚类，同主题≥3
  const turnEvents = await getMergedParentInputHistory(tenant, 30)
  const themeClusters = clusterByTheme(turnEvents, dossier) // 按 matchedMechanisms 或 protective.id 聚类
  const repeated = themeClusters.find(c => c.count >= 3)
  if (repeated) {
    return { should: true, reason: 'intervention_failed' as const, failedTaskId: failedTasks[0].id, repeatedTheme: repeated.theme }
  }
  return null
}
```
- `clusterByTheme` 实现：每条 turn_event 读 `retrievedContextSnapshot.matchedMechanisms`（或 dossier.protective.id），按机制/protective 分组计数。

**2. `src/lib/server/memory/database-manager.ts`**：
- 加 `getRecentFailedTasks(tenant, days)`：读 user_tasks，filter `feedback LIKE '%未达预期%' OR status = 'completed_but_unsatisfied'`，返回近 N 天。

**3. `prompts/background/portraitSynthesizer.md`**：
- 在「Level 1 vs Level 2」段加：
```markdown
### intervention_failed 时（L2 触发于干预无效）
- 被提示「前一版假设的 T 干预无效，重新审视是否漏了维持因素/高估了保护因素」
- changeLog 必说明「T 失败 → 重新审视 M/PR」
- 必须新增或调整至少一个 perpetuating 因素（漏了的维持因素）
```

**给 Trae 的回报**：贴 should-reconceptualize.ts diff（确认 regex 已删）+ checkInterventionFailed 实现 + clusterByTheme 实现。Trae 审是否真用结构化字段而非关键词。

---

### P1-5 · router.ts slice(0,3) → 8

**单行改动**：

`src/lib/server/memory/retrieval/router.ts` L248-249：
```typescript
// 改前
const mechanismCards = dossierSliceLines.length > 0 ? mechanismCards.slice(0, 3) : mechanismCards
// 改后
const mechanismCards = formatMatchedMechanismCards(network?.candidateMechanismMatrix, { limit: MATCHED_MECHANISMS_CARD_LIMIT })
```
（确保有 dossier 时也走 `MATCHED_MECHANISMS_CARD_LIMIT=8`，与 digest-limits.ts 一致）

**给 Trae 的回报**：贴 router.ts L245-255 diff。Trae 审 slice 是否真统一 8。

---

### P1-8 · db.ts schema 确认

**步骤**：
1. 读 `src/lib/server/db.ts` 找 `memory_layer_items` 表 DDL。
2. 确认：
   - `item_id` 是否支持 `dossier_v{n}` 格式（通常是 TEXT，应支持）
   - `data` 是否 JSONB（支持 dossier 完整结构 + schemaVersion 字段）
   - 是否需加索引（如 `(layer_name, item_id)` 复合索引，若没有则补 migration DDL）
3. 验证 `getDossierHistory(tenant)` 能查回所有版本：
```typescript
// 应能查 layer_name='deep_model_digest' AND item_id LIKE 'dossier_v%' ORDER BY item_id DESC
```
4. 若需 migration，写 DDL 到 `src/lib/server/db.ts` 的 migration 段（或单独 migration 文件，看项目惯例）。

**给 Trae 的回报**：贴 memory_layer_items DDL + getDossierHistory 实现 + 是否需 migration 的结论。Trae 审历史版本是否真可查。

---

### P2-9 · parent-facing-copy visible section payload 改薄

**逐文件改动**：

`src/lib/server/daily/parent-facing-copy.ts` L85-95：
```typescript
// 改前：仅全 hidden 改薄
const payload = skeletons.every((s) => s.hidden)
  ? { dossierSlice: ..., deepModelDigest, userText, inputType, sectionSkeletons }
  : buildDailyProsePayload(...)  // visible 仍走完整包

// 改后：visible 也改薄，dossierSlice 优先
const frontendPack = pickFrontendReadPack(...)
const payload = (frontendPack.dossierSlice?.length > 0)
  ? { dossierSlice: frontendPack.dossierSlice, deepModelDigest: options?.deepModelDigest, userText, inputType, sectionSkeletons }
  : buildDailyProsePayload(...)  // 仅 dossierSlice 缺失才回退完整包
```

**给 Trae 的回报**：贴 parent-facing-copy.ts L80-100 diff。Trae 审 visible 是否真改薄 + 完整包是否仅兜底。

---

## 收尾（所有 P0/P1/P2 完成后）

1. `npm run typecheck`（exit 0）
2. `npm run lint`（exit 0，允许 react-hooks/exhaustive-deps warning）
3. `npm run test:contracts`（slice 一致 + dossierSlice 填充）
4. 人工验收 3 个模拟：
   - 造一条 user_tasks feedback=未达预期 + linkedPredictionId=pred_1，看 shouldReconceptualize 是否返回 `reason: 'prediction_failed'`
   - 造一条任务未达预期 + 同主题 turn_events ≥3，看是否返回 `reason: 'intervention_failed'`
   - 造一个 dossier 看 evidenceSummary 标签是否全在 8 个之内
5. 远程 `npm run deploy` build ready:true
6. `[cursor]` 前缀 commit + push

**给 Trae 的完整回报**：所有 diff + typecheck/lint/test 结果 + 3 个模拟验收结果。Trae 按 checklist 逐项审，全 ✅ 才放行。
