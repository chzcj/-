# 家庭互动模式：多阶段字段对照（不合并 schema）

> 原则：**L7 `family_interaction_cycles` 是唯一真源**；其他阶段的 `familyInteraction*` 字段是管道中间产物或展示别名，读取 daily AI 时统一走 retrieval → `familyPatterns`。

## 五处字段一览

| 字段名 | 所在层/产物 | 写入方 | 读取方（daily AI） | 说明 |
|--------|-------------|--------|-------------------|------|
| `familyInteractionPatterns` | Board 看板 JSON、retrieval packet | `boardUpdater`、router 从 L7 拼 | → `FrontendReadSchema.familyPatterns` | 家长可见中性描述，1–3 条 |
| `familyInteractionCycles` | L7 `family_interaction_cycles` 表 | diagnosis `executeWritePlan` | router `getFamilyInteractionCycles` | **唯一持久真源** |
| `familyInteractionLoop` | diagnosis 输出（单条主循环） | diagnosis pipeline | diagnosis handoff、decision-engine 转 L7 | 诊断阶段结构化循环，落库后变 L7 |
| `familyInteractionChain` | evidence_networks 机制矩阵子字段 | synthesis / deep_mechanism | 后端思考 Agent 全量读；**不进** FrontendReadSchema | 机制内的「家长动作→孩子反应」链 |
| `familyInteractionCandidates` | synthesis 输出 | synthesis pipeline | synthesis → diagnosis handoff | 草案候选名，不直喂 daily prose |

## 读取统一路径（daily 前台）

```
family_interaction_cycles (L7)
  → buildDailyDialogueRetrievalPacket.familyInteractionPatterns
  → OrchestrationOutput.retrievedContext.relevantFamilyInteractionPatterns
  → pickFrontendReadPack().familyPatterns
  → buildDailyProsePayload.retrievalPack
```

**禁止**：daily prose/section LLM 直读 `familyInteractionLoop` 对象、`familyInteractionChain` 全量、board JSON 文件。

## 与条件画像的关系

互动模式（L7）描述**家庭系统怎么转**；条件画像（L5 `ConditionalProfile`）描述**孩子在什么场景下怎样**。二者互补，均在 `FrontendReadSchema` 中有独立槽位（`familyPatterns` / `childStructureModels`）。

## 条件画像两阶段（草案 vs 成型）

| 阶段 | 字段 | 类型 | 用途 |
|------|------|------|------|
| 草案 | `SynthesisOutput.childStructureModelDraft.primaryConditionalProfile` | `string` | synthesis→diagnosis handoff，120–200 字 |
| 成型 | `ChildStructureModel.primaryConditionalProfile` | `ConditionalProfile \| null` | L5 落库，含 triggerScene/childTendency 等 |
| 快照 | `built_profile_snapshots.coreJudgment` | `string` | 家长可见画像文本 fallback |

**读取规则**：凡塞进 LLM material 的画像文本，统一取 `.childTendency` 字符串（或 `coreJudgment` fallback），禁止把 `ConditionalProfile` 对象 JSON 化喂给前端 AI。

实现参照：
- `src/lib/server/memory/retrieval/router.ts`（`matchingProfile = model?.primaryConditionalProfile?.childTendency`）
- `src/lib/server/profile-rewrite.ts`（`primaryConditionalProfile?.childTendency`）

## 验证

```bash
npx tsx scripts/test-frontend-read-pack.mjs
node scripts/verify-conditional-profile-reads.mjs
```
