# BFF 三段式整理（日常交流链路）

> 状态：整理文档，不改代码。回应你早期要求"不要忘了今天我说的关于前端后端BFF的这个从事的整理"。
> 基于全链路探测（[front-agent-sp-redundancy-audit.md](./front-agent-sp-redundancy-audit.md) 同源探测）。
> 目的：给协作者一份"家长一句话到 prose 输出"的清晰三段式地图，哪段不调 LLM、哪段调、token 烧在哪。

---

## 三段式总览

```
家长输入
  ↓
【段① 规则编排】不调 LLM，纯代码规则 + DB 检索
  - 安全/风险分级、信息够不够、像不像新机制/反证/轻寒暄
  - 决定本轮类型、出哪些 section 骨架
  ↓
【段② 组装厚包】不调 LLM，确定性拼装
  - retrievalPack（10 类字段，从 DB 捞+slice）
  - deepModelDigest（从 deep_model_digest 层读，缺失才现算调 LLM）
  - dossierSlice（v3 新增，从 dossier 切段落）
  ↓
【段③ LLM 表达】烧 token 主战场，3 处调用
  - 主调用：prose + visible section（Text Stream，合并一次）
  - hidden 预取：hidden section（Fast JSON，并行）
  - safety 路径：safety 轮独立 Text Stream
  ↓
prose + sections + actions → 前端流式渲染
```

---

## 段① 规则编排（不调 LLM）

**入口**：[app/api/daily/stream/route.ts](file:///Users/mac/Desktop/育见-2/app/api/daily/stream/route.ts) `POST` → `runDailyTurnBff`

**核心函数**：[`runOrchestrationPipeline`](file:///Users/mac/Desktop/育见-2/src/lib/server/orchestration/pipeline.ts)

**做什么**（纯 if/规则，0 token）：
1. 安全/风险分级（`inputType=risk_followup` 走独立分支）
2. 信息够不够（`relationshipToExistingModel.type=insufficient` → 追问）
3. 像不像新机制/反证/轻寒暄/旧重复（`relationshipToExistingModel.type`）
4. 路由决策（`routingDecision`: frontResponseType / needFollowup / followupQuestion）
5. 出哪些 section 骨架（调 `composeDailySections`，纯规则）

**产出**：`OrchestrationOutput`（含 `inputType` / `relationshipToExistingModel` / `routingDecision` / `retrievedContext`）

**内部调用的子步骤**（仍不调 LLM）：
- `buildDailyDialogueRetrievalPacket`（段②的入口，orchestration 内部调）—— 10 路并行读 DB

**成本**：0 chat token，仅检索/embed 算力

---

## 段② 组装厚包（不调 LLM，但包越大段③越贵）

**核心函数**：
- [`buildDailyDialogueRetrievalPacket`](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/retrieval/router.ts) —— 组装 retrievalPack
- [`ensureDigestPack`](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/daily-turn-bff.ts) —— 加载/现算 digest
- [`pickFrontendReadPack`](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/frontend-read-pack.ts) —— 厚包切片
- [`buildDailyProsePayload`](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/prose-context.ts) —— 拼最终 payload

**retrievalPack 10 类字段 + slice 上限**：

| 字段 | 来源 DB 层 | slice 上限 | 说明 |
|------|-----------|-----------|------|
| childStructureModels | child_structure_models | 24 | 孩子结构模型 |
| entryEvidence | entry_evidence_packs | 24 | 四模块证据包 |
| entryFacts | entry_evidence_packs 合并 | 80 | 四模块 verifiableFacts 等 |
| matchedMechanisms | evidence_networks → formatMatchedMechanismCards | 20（内部）/ 40（厚包）| **双 slice 不一致，v3 统一为 8** |
| familyPatterns | family_interaction_cycles | 20 | 家庭互动循环 |
| parentUnderstanding | parent_narrative_patterns | 24 | 家长叙述模式 |
| recentEvents | daily_updates | 24 | 近期对话事件 |
| pendingHypotheses | pending_hypotheses | 20 | 待验证假设 |
| childQuotes | highValueAtoms child_quote | 32 | 孩子原话（v3 砍依赖） |
| parentVerbatimSnippets | daily_updates | 32 | 家长原话 |

**deepModelDigest 字段**（从 `deep_model_digest` 层读，[`pickDeepModelDigestPack`](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts) 切片）：
- mechanismNarrative（整段，v3 改 ← integratedSynthesis）
- interactionLoops:12 / anchoredFacts:24 / parentVerbatimSnippets:16 / childQuotes:16 / openHypotheses:12 / structuralTensions:8

**dossierSlice（v3 新增）**：按本轮 query 从 dossier 切段落，`sliceForDaily(query, dossier)`

**成本**：本身 0 chat token，但**包越大段③ input token 越贵**——这就是"贵的不只是家长看到的那几句，而是每次都要先读这么厚一摞材料"。hidden section 还会再喂一遍类似的包（[parent-facing-copy.ts payload](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts)）。

**关键观察**：digest 与 orchestration **并行**（`Promise.all`），digest 不依赖本轮输入。

---

## 段③ LLM 表达（烧 token 主战场）

**3 处调用**：

### 3a · 主调用：prose + visible section 合并流式
- **函数**：[`streamProseAndSections`](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/prose-section-stream.ts)
- **底层**：`requireTextStream`（Text Stream）
- **system**：`parentFacingStyle + deepModelingParentDigest + dailyDialogueOrchestration + parentFacingCopy`（4 拼接）
- **user**：`buildDailyProsePayload`（packReadingGuide + retrievalPack + deepModelDigest + dossierSlice + writingRules + userText + proseMode...）
- **输出**：先 prose，再按 `---section:{id}---` marker 紧接输出 section + `---task---` + taskTitle
- **优化**：合并一次调用消除 prose 完成后 section 首字等 7.6s 排队
- **disableThinking**：前台关模型隐式思考（深度来自注入包，后台已思考），首字延迟 3-12s → ~1s

### 3b · hidden section 预取（并行，Fast JSON）
- **函数**：[`fillDailySectionCopy`](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts)
- **底层**：`requireFastJson`（Fast JSON）
- **system**：`parentFacingStyle + deepModelingParentDigest + parentFacingCopy`（3 拼接，**与主调用 system 高度重叠**）
- **user**：payload 带 retrievalPack（**与主调用 payload 高度重叠**——R1 冗余点）
- **触发**：`hiddenAfterPolicy.length > 0`
- **hidden 骨架来源**：`composeDailySections` 输出 `hidden:true` 项（professional_perspective / parent_action / child_viewpoint / profile_reading / deep_analysis）

### 3c · safety 路径（独立分支）
- **函数**：[`generateDailyProse`](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/daily-turn-bff.ts) safety 分支
- **底层**：`requireTextStream`（Text Stream）
- **system**：`parentFacingStyle + dailyDialogueOrchestration`（2 拼接）
- **触发**：safety 轮

**成本**：主调用 ~3072 maxTokens + hidden ~3072 maxTokens + safety（偶发）。**hidden 二次喂厚包是 token 大头之一**。

---

## 三段式与写入的衔接（turn_event / episode_ingest / memory_write）

**在段③完成后、流关闭前**（[route.ts:108-162](file:///Users/mac/Desktop/育见-2/app/api/daily/stream/route.ts)）：

1. **saveTurnEvent**（L0，每轮必写，fire-and-forget）—— `memory_layer_items` layer=`turn_events`，item_id=traceId，存 `retrievedContextSnapshot`（含 matchedMechanisms）
2. **门控** `shouldWriteL1 = !safety && relType!=='insufficient' && !短寒暄`
3. **memory_write 入队**（[route.ts:147](file:///Users/mac/Desktop/育见-2/app/api/daily/stream/route.ts)）—— `enqueueJob('memory_write', {plan, tenant}, 'memory_write:'+traceId, traceId)`
4. **effective turn 计数**（[route.ts:149](file:///Users/mac/Desktop/育见-2/app/api/daily/stream/route.ts)）—— 每 10 轮 milestone 触发 deep_mechanism_review
5. **episode_ingest 入队**（[route.ts:159](file:///Users/mac/Desktop/育见-2/app/api/daily/stream/route.ts)）—— `enqueueJob('episode_ingest', {text, ctx}, 'episode_ingest:'+episodeId, traceId)`

**关键**：写入是 fire-and-forget，不阻塞前台响应。memory_write 链式触发 digest_update / model_review / deep_mechanism_review（后台异步）。

---

## dossier v3 对三段式的影响（最小侵入）

| 段 | v3 改动 | 不变 |
|----|---------|------|
| 段① | 无 | orchestration 纯规则不变 |
| 段② | retrievalPack 加 dossierSlice 字段；matchedMechanisms 双 slice 统一 8；digest 从 dossier 投影 | 10 类字段结构不变，厚包拼装流程不变 |
| 段③ | 主调用 system 字段引用改 dossierSlice；hidden payload 改薄（R1）；taskTitle 取 interventionTargets（R5）；删 professional_perspective（R2） | 3 处 LLM 调用结构不变，流式协议不变 |
| 写入 | memory_write 链尾加 dossier_patch（L1）；shouldReconceptualize 并入 deep_mechanism_review 入口（L2） | turn_event / episode_ingest / memory_write 触发不变 |

**契约不变**：`DailyStreamEvent` / `DailySection` / `DailyAction` 形态不动，小程序零改。

---

## 给协作者的速查

- **哪段不花钱**：段①（规则编排）、段②（组装厚包）—— 0 chat token
- **哪段花钱**：段③（LLM 表达）—— 3 处调用，主调用 + hidden 是大头
- **hidden 为什么贵**：二次喂类似厚包（R1 冗余），v3 改薄
- **matchedMechanisms 为什么像豆包**：段② formatMatchedMechanismCards 拼成"名+描述+依据+保护"直喂段③，段③ 只能贴卡。v3 改 dossierSlice 取代
- **写入什么时候发生**：段③ 完成后 fire-and-forget，不阻塞前台
- **后台深度链什么时候跑**：memory_write 链式 + 每 10 轮 + episode_ingest 链式 + 登录 + 四模块齐，5 路触发（v3 加 debounce 去重）
