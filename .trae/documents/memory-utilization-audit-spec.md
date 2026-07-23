# 育见小程序 · 家长记忆数据全链路审计（项目实情版）

> 本文档由 Trae 于 2026-07-19 基于 5 条并行链路探查（契约/BFF/Job/SP/前端）产出。
> 替换原稿里通用 SaaS 假设（Redis/MySQL/MemoryAdvisor），对齐育见真实架构。
> **Part 1** 是优化后的审计提示词（可直接当系统提示词用）；
> **Part 2** 是真实利用率报告（已跑完一遍的结论）；
> **Part 3** 是分模块整改清单（P0/P1/P2）。

---

## Part 1 · 项目实情版审计提示词

### 角色与边界

你是育见（ChildOS）的**全链路记忆审计 Agent**。产品形态：

- **小程序**：Taro 四 Tab — 交流 / 任务 / 预演 / 画像（+ 分包建档 onboarding）
- **BFF**：Next.js `app/api/*`，部署 `yujian.yihe.site`
- **记忆真源**：PostgreSQL `memory_layer_items`（24 个 layer_name）+ `job_queue`（16 个 Job handler）+ 独立表 `family_memory_digests` / `board_snapshots`
- **契约真源**：`docs/contracts/read-contract.md`、`memory-read.md`、`memory-write.md`、`daily-stream-events.md`、`handbook-pack-trace.md`
- **架构图**：`docs/architecture/agent-memory-workflow.md`

**禁止**按「新建 MemoryAdvisor 中间件 + Redis + MySQL 画像库」描述；应在现有 **`retrieval/router` → `frontend-read-pack` → Agent SP → Job 写回** 链路上找断点。

### 核心审计维度（5 条链路）

#### 链路 1 · 契约层
- `docs/contracts/read-contract.md` — 前台只读 11 键 vs 后台全量读写分界
- `docs/contracts/memory-read.md` — 各 layer 的 reader 路径
- `docs/contracts/memory-write.md` — 各 Job 的 writer 路径
- `docs/contracts/daily-stream-events.md` — 流式事件契约
- `docs/architecture/agent-memory-workflow.md` — Job 链依赖图

**核验点**：
1. FrontendReadSchema 11 键的 slice 上限，契约 doc 与代码 `SLICE_LIMITS_THICK` 是否一致（已知有 9 个键不一致）
2. 哪些 layer_name 是 dead layer（`raw_materials` / `cleaned_facts` / `retrieval_indexes` 已显式停写）
3. 哪些 layer 写入了但契约里没声明 reader（`deep_mechanism_handoffs` 仅审计脚本读、`saveEnrichedHandbookCandidate` 疑似无 reader）

#### 链路 2 · BFF 三段式
- 段① 规则编排（无 LLM）：`pipeline / section-composer`
- 段② 厚包组装（无 LLM）：`router + pickFrontendReadPack + buildDailyProsePayload`
- 段③ LLM 表达：`registry SP + stream`
- Job 链：`memory_write / deep_mechanism / digest_update`（异步加厚）

**核验点**：
1. `pickFrontendReadPack()` 11 字段是否都非空（厚包默认开 `FAMILY_MEMORY_THICK_PACK=1`）
2. `buildDailyProsePayload()` 输出的字段，LLM task 指令是否真正引导读取（`internalFieldsForRoutingOnly` 5 字段被显式标注不读）
3. **hidden section 在 dossierSlice 有内容时是否丢弃 retrievalPack**（`parent-facing-copy.ts:107-114` 是最显著断点）
4. `fillDailySectionCopy` 产出的 `taskTitle` 是否被消费（已知是孤儿字段）
5. safety 路径是否短路跳过 LLM（`daily-turn-bff.ts:81-85`）

#### 链路 3 · Job 写回链
- `episode_ingest`（写 episodes/atoms + 触发 deep_mechanism_review）
- `memory_write`（写 10 个 layer + 链尾 dossier_patch）
- `deep_mechanism_review`（5 路触发：daily bucket / episode / 10 turns / login / build）
- `digest_update`（产出 deep_model_digest）
- `model_review`（更新 pending_hypotheses 权重）
- `profile_build_run`（synthesis → diagnosis → persist → readiness）

**核验点**：
1. `deep_mechanism_review` 的 `sharedContext.dailyUpdates` 实际喂 LLM 多少条（`getMergedParentInputHistory(tenant, 100)` 取 100 条，但 `sliceParentInputTexts(inputHistory, PARENT_INPUT_WINDOW)` 再切）
2. `THEORY_CARDS` 是 system 前缀还是 user payload（已知是 system 前缀，利于 prompt cache；但文档说 15×9，代码实际 20 张 × 7 rich 字段）
3. `should-reconceptualize.ts` 的 `prediction_failed` 是否接 L2（已接，结构化字段判定）、`intervention_failed` 是 regex 还是结构化（混合：`status==='completed_but_unsatisfied'` + `blob.includes('未达预期')`）
4. 每个 Job 产出的字段，代码层能否找到 reader（`dossierProjection` 非 DeepModelDigest 持久化字段、`saveEnrichedHandbookCandidate` 疑似 dead write）

#### 链路 4 · 前台 SP + enrich
- `prompts/front/dailyDialogueOrchestration.md` — 交流 prose
- `prompts/front/dailyPortraitRefresh.md` — 画像摘要（7 张卡）
- `prompts/front/communicationRehearsal.md` — 预演
- `prompts/core/parentFacingStyle.md` — 文风宪法
- `prompts/core/deepModelingParentDigest.md` — digest 读包
- `src/lib/server/profile/portrait-card-enrich.ts` — 兜底加厚

**核验点**：
1. 每个 SP 是否明确要求引用 `entryFacts / parentVerbatimSnippets`（原话锚定），引用多少条，不引用会怎样
2. `parentFacingStyle` 是否被编入每个前台 Agent（已知 `dailyPortraitRefresh` 未显式声明编入）
3. 禁止词清单（「主1/次2」、理论名）有没有同步到所有核心 SP（已知「主1/次2」只在 `dailyPortraitRefresh` 单独声明）
4. `portrait-card-enrich.ts` 在 `preferLlm=true` 时是否仍注入 digest 学术 heading（tensions 卡有照抄学术 title 风险）
5. dossier v3 五段投影（integratedSynthesis/workingHypothesis/sceneReadings/interventionTargets/familyStruct）是否在所有 SP 铺开（已知只在 `dailyPortraitRefresh` 和 `deepModelingParentDigest` 里，`dailyDialogueOrchestration` 和 `communicationRehearsal` 只笼统提 `dossierSlice`）

#### 链路 5 · 小程序前端消费
- 交流 `pages/daily/` — `/api/daily/stream` + NDJSON
- 画像 `pages/profile/index/` — `daily-refresh` + hub
- 卡片详情 `pages/profile/card/` — `/api/profile/card/:id`
- 机制链/依据/待验证 `pages/profile/deep|evidence|verify/`
- 预演 `pages/rehearsal/` — `/api/rehearsal/analyze`
- 建档结果 `packageOnboarding/pages/result/`
- 任务 `pages/tasks/`

**核验点**：
1. 画像 Tab 是否每次进 Tab 触发 daily-refresh（5 分钟防抖）+ cache 多久（90s）
2. `HubPayload` 声明的字段是否都被 `applyHubData` 消费（已知 `pendingHypothesesList / highlights / presentationWatermark.uiStale / digestStale / buildRunStatus` 声明了但没消费）
3. 预演 handoff 从交流带什么（已知 `REHEARSAL_HANDOFF_KEY` 定义了但 daily/index.tsx 没写入）
4. 预演 end 步骤是否大量 hardcode 通用模板（已知是）
5. 建档结果页 Hero 是否与 snapshot 字段无关（已知是固定 hardcode）
6. 每个页面"明显的通用模板文案"清单

### 给审计 Agent 的执行口令

```
你是育见记忆全链路审计员。按 docs/contracts/read-contract.md 与 
docs/architecture/agent-memory-workflow.md 工作。

对每个家长可见场景，填表：
场景 | API/Job | 记忆读路径（文件/函数+行号）| 写入层 | 小程序消费字段 | 是否空转 | 判定

禁止建议引入 Redis/MySQL 双库或全新 MemoryAdvisor。
优先查：
1. parent-facing-copy.ts hidden payload 是否丢 retrievalPack
2. portrait-card-enrich.ts tensions 是否照抄学术 title
3. rehearsal handoff 是否空、end 步骤是否 hardcode
4. 建档结果页 Hero 是否与 snapshot 无关
5. HubPayload 声明但未消费的字段
6. dailyDialogueOrchestration / communicationRehearsal 是否按 dossier v3 五段拆分

输出：问题清单（现象/根因/文件+行号）+ P0/P1 整改 + 验收命令。
```

### 验收命令

```bash
npm run audit:memory-contract          # 契约静态
npm run test:frontend-read-pack        # 厚包 schema
node scripts/test-retrieval-packet.mjs # retrieval 聚合
node scripts/test-xiaoyin-corpus.mjs   # 小尹语料全链路
node scripts/audit-deep-modeling-pipeline.mjs  # 深度机制链
```

---

## Part 2 · 真实利用率报告（2026-07-19 跑完一遍的结论）

### 总体判定

**原稿「利用率 <5%」过于绝对**。真实情况是**分层不一致**：

| 场景 | 利用率 | 关键证据 |
|---|---|---|
| 交流 Tab prose | **中高** | 厚包默认开，11 字段全注入，SP 明确要求通读 |
| 画像 Tab 摘要卡 | **中** | SP 要求基于事实，但 enrich 兜底有学术 title 风险 |
| 卡片详情 | **中** | 读 snapshot + enrich，但空态是模板 |
| 机制链/依据/待验证 | **低→中** | 字段读得不充分，空态是"继续交流后会补充" |
| 预演 Tab | **低** | handoff 空、end 步骤全 hardcode |
| 建档结果页 | **低** | Hero 与 snapshot 完全无关 |
| 任务 Tab | **低**（设计如此） | 与记忆链弱耦合 |
| 结构层→展示层转化率 | **核心短板** | dossier v3 五段投影只在 2 个 SP 铺开 |

### 18 个真实断点（按严重度）

#### P0 · 致命（采集了完全没用上）

**断点 1 · hidden section 丢弃 retrievalPack**
- 文件：[parent-facing-copy.ts:107-114](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts#L107-L114)
- 现象：dossierSlice 有内容时，hidden payload 只保留 `dossierSlice / deepModelDigest / userText / inputType / sectionSkeletons`，**retrievalPack / packReadingGuide / packStats / writingRules 全部被丢弃**
- 后果：hidden section LLM 只能看到 dossierSlice 一份切片 + digest，看不到 entryFacts / childQuotes / familyPatterns / parentVerbatimSnippets
- 根因：瘦身路径过度优化，把档案包整个砍了

**断点 2 · 预演 handoff 是空的**
- 文件：[rehearsal/index.tsx:50-56](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L50-L56) 定义，[daily/index.tsx](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/daily/index.tsx) 未写入
- 现象：`REHEARSAL_HANDOFF_KEY` 类型定义了 `sceneId / seedText / parentText / rehearsalGoal / traceId`，但 daily/index.tsx 里没看到 `setStorageSync(REHEARSAL_HANDOFF_KEY, ...)`
- 后果：从交流 Tab 直跳预演的 handoff 实际是空的，不带任何记忆摘要
- 根因：handoff storage key 定义了但交流页没写入逻辑

**断点 3 · 预演 end 步骤全 hardcode 通用模板**
- 文件：[rehearsal/index.tsx:770-819](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L770-L819)、[L553-L565](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L553-L565)、[L331](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L331)、[L347](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L347)、[L351](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L351)、[L778](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L778)、[L786](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L786)、[L794](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx#L794)
- 现象：statusText="当前状态:孩子有点烦,防御比较高" / openingHint="他现在更像是在把你推开。" / openingChild="你别催我行不行,我又不是不写。" / confirmBullets 3 条 / closingAdvice / childLikelyHearing / saferVersion 全是写死的
- 后果：预演方案与该用户的画像/场景/短板完全无关，所有家庭看到一样的话
- 根因：fallback 文案写死，没接 endData 后端字段

**断点 4 · 建档结果页 Hero 与 snapshot 完全无关**
- 文件：[packageOnboarding/pages/result/index.tsx:132-145](file:///Users/mac/Desktop/育见-2/miniprogram/src/packageOnboarding/pages/result/index.tsx#L132-L145)
- 现象：Hero 固定 hardcode `kicker='画像已生成'` / `title='可以开始交流和预演了'` / `copy='下面的理解会作为后续对话的背景。'`
- 后果：建档刚完成，家长看到的 Hero 与自己刚填的内容完全无关
- 根因：Hero 不读 snapshot 字段

**断点 5 · enrich tensions 卡照抄学术 title**
- 文件：[portrait-card-enrich.ts:87](file:///Users/mac/Desktop/育见-2/src/lib/server/profile/portrait-card-enrich.ts#L87)
- 现象：把 `pack.structuralTensions` 直接塞进 items
- 后果：在 `preferLlm=false` 或 LLM 三字段全空时，学术 title（如「高情感接纳与低行为结构之间的失衡」）会直接流入 UI
- 根因：enrich 兜底路径绕过了 [dailyPortraitRefresh.md:61](file:///Users/mac/Desktop/育见-2/prompts/front/dailyPortraitRefresh.md#L61) 的"禁止照抄"翻译要求

#### P1 · 重要（部分用了但质量受损）

**断点 6 · fillDailySectionCopy 产出的 taskTitle 是孤儿字段**
- 文件：[parent-facing-copy.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts) 产出，[daily-turn-bff.ts:188-191](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/daily-turn-bff.ts#L188-L191) 只取 sections
- 后果：hidden 调用的 taskTitle 提炼白做，浪费 token

**断点 7 · enrich 静态空话模板**
- 文件：[portrait-card-enrich.ts:166](file:///Users/mac/Desktop/育见-2/src/lib/server/profile/portrait-card-enrich.ts#L166)
- 现象：「继续交流后,这里会出现更完整的深度分析。」是纯静态模板
- 后果：与 [dailyPortraitRefresh.md:12](file:///Users/mac/Desktop/育见-2/prompts/front/dailyPortraitRefresh.md#L12)「禁止「需要多关注」空话」存在契约张力

**断点 8 · 「主1/次2」禁止词未同步到核心 SP**
- 文件：仅在 [dailyPortraitRefresh.md:10](file:///Users/mac/Desktop/育见-2/prompts/front/dailyPortraitRefresh.md#L10) 单独声明
- 后果：[parentFacingStyle.md:186](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md#L186) 和 [deepModelingParentDigest.md:54-58](file:///Users/mac/Desktop/育见-2/prompts/core/deepModelingParentDigest.md#L54-L58) 的禁止清单都没收录

**断点 9 · dailyDialogueOrchestration / communicationRehearsal 未按 dossier v3 五段拆分**
- 文件：[dailyDialogueOrchestration.md:16](file:///Users/mac/Desktop/育见-2/prompts/front/dailyDialogueOrchestration.md#L16)、[communicationRehearsal.md:22](file:///Users/mac/Desktop/育见-2/prompts/front/communicationRehearsal.md#L22)
- 现象：只笼统提 `dossierSlice`，未按 integratedSynthesis / workingHypothesis / sceneReadings / interventionTargets / familyStruct 五段拆分取用
- 后果：读包颗粒度落后于 dossier v3 契约

**断点 10 · parentFacingStyle 未显式编入 dailyPortraitRefresh**
- 文件：[dailyPortraitRefresh.md](file:///Users/mac/Desktop/育见-2/prompts/front/dailyPortraitRefresh.md) 全文未出现「parentFacingStyle」字样
- 后果：需查 `registry.generated.ts` 确认是否在拼装层补上；若未补，则 dailyPortraitRefresh 没继承 parentFacingStyle 的完整禁止清单

**断点 11 · HubPayload 声明但未消费的字段**
- 文件：[profile/index.tsx:32-54](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/profile/index.tsx#L32-L54) 声明，[L124-L144](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/profile/index.tsx#L124-L144) `applyHubData` 未消费
- 现象：`pendingHypothesesList / highlights / presentationWatermark.uiStale / digestStale / buildRunStatus` 声明了但没用
- 后果：后端产出了这些字段但前端没用，浪费 BFF 计算和传输

**断点 12 · deep/evidence/verify 子页字段读得不充分**
- 文件：[deep/index.tsx:28-36](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/profile/deep/index.tsx#L28-L36)、[evidence/index.tsx:20-29](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/profile/evidence/index.tsx#L20-L29)、[verify/index.tsx:19-28](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/profile/verify/index.tsx#L19-L28)
- 现象：deep 只用 `portraitCards.growth` 的 lead；evidence 只从 `portraitCards.behavior.sections` 展开；verify 只从 `portraitCards.hypotheses.sections` 展开
- 后果：没读 hub 的 `pendingHypothesesList / anchoredFacts` 等"依据"语义字段

**断点 13 · daily thinkingChips fallback 是通用模板**
- 文件：[daily/index.tsx:33-38](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/daily/index.tsx#L33-L38)
- 现象：`LOADING_THINKING_CHIPS` 4 条全部 text="还在了解"
- 后果：当 hub 未返回 thinkingChips 时，兜底是固定模板，不是根据已有 profile 生成

**断点 14 · daily 不带 retrievedContextSnapshot**
- 文件：[dailyStream.ts:233-237](file:///Users/mac/Desktop/育见-2/miniprogram/src/services/dailyStream.ts#L233-L237)
- 现象：POST body 仅 `{ text, warmTurn, recentSectionIds }`，recentSectionIds 只是最近 3 轮 AI 的 section id 列表
- 后果：前端不回传 retrievedContextSnapshot，跨轮上下文连续性依赖 BFF 侧

#### P2 · 优化（已知但非阻塞）

**断点 15 · THEORY_CARDS 文档与代码不符**
- 文件：[theory-cards.ts:36](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/theory-cards.ts#L36) 注释说 15×9，[pipeline.ts:530](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts#L530) 注释也说 15×9
- 实际：20 张卡 × 7 rich 字段（10 张完整、3 张部分、7 张 legacy 简版）
- 后果：文档误导，审计时容易误判

**断点 16 · profileChipPanels SP 已删除但概念残留**
- 历史：2026-07-14 20:55 删除（见 HANDOFF.md:2450-2451）
- 现状：deep/evidence/verify 子页改读 portraitCards 的 lead/sections
- 后果：字段映射不够充分（见断点 12）

**断点 17 · deep_mechanism_handoffs 疑似 dead write**
- 文件：[handoff-store.ts:48](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/handoff-store.ts#L48) 写入
- reader：仅 [audit-deep-modeling-pipeline.mjs:32](file:///Users/mac/Desktop/育见-2/scripts/audit-deep-modeling-pipeline.mjs#L32) 审计脚本读
- 后果：契约文档未声明 reader，前台/后台 Agent 都不读

**断点 18 · saveEnrichedHandbookCandidate 疑似 dead write**
- 文件：[episode/pipeline.ts:167-181](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/episode/pipeline.ts#L167-L181) 触发
- reader：grep 未找到对应的 load/get 函数
- 后果：handbook 候选补料可能白做

### 契约 doc 与代码实现的差异清单

1. `family_interaction_cycles`（契约 doc）vs `interaction_cycles`（代码 layer_name 实际值）
2. 厚包 slice 上限：契约 doc 9 个键小于代码 `SLICE_LIMITS_THICK`（仅 entryFacts/dossierSlice/matchedMechanisms 一致）
3. `memory-write.md:33-38` 说 `memory_write → deep_mechanism_review(每日桶)`，但代码 `queue.ts:160` 注释"日桶不再链式 deep_mechanism_review"——实际仅在 `episode_ingest` 完成后链式触发

---

## Part 3 · 分模块整改清单

### 模块 1 · 统一「展示层读包」契约（优先于新建中间件）

**目标**：所有家长可见文案，只从两类源读取：
1. **段② 厚包** — `pickFrontendReadPack` / `deepModelDigest`（交流、预演、部分 BFF）
2. **展示层快照** — `daily_ui_snapshot`（画像 Tab、chip 页、result brief）

**P0 动作**：
- 修复 [parent-facing-copy.ts:107-114](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts#L107-L114) hidden payload 丢 retrievalPack 问题（dossierSlice 有内容时也应保留 entryFacts / childQuotes / parentVerbatimSnippets 至少前 5 条）
- 修复 [portrait-card-enrich.ts:87](file:///Users/mac/Desktop/育见-2/src/lib/server/profile/portrait-card-enrich.ts#L87) tensions 卡照抄学术 title（enrich 兜底时也要翻译，或直接不兜底 tensions 卡）
- 修复 [rehearsal/index.tsx](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx) end 步骤 hardcode（接 endData 后端字段）
- 修复 [packageOnboarding/pages/result/index.tsx:132-145](file:///Users/mac/Desktop/育见-2/miniprogram/src/packageOnboarding/pages/result/index.tsx#L132-L145) Hero hardcode（读 snapshot.coreJudgment / portraitCards.growth）

**P1 动作**：
- 收敛 [portrait-card-enrich.ts:166](file:///Users/mac/Desktop/育见-2/src/lib/server/profile/portrait-card-enrich.ts#L166) 静态空话模板
- 补全 [parentFacingStyle.md:186](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md#L186) 和 [deepModelingParentDigest.md:54-58](file:///Users/mac/Desktop/育见-2/prompts/core/deepModelingParentDigest.md#L54-L58) 的「主1/次2」禁止词
- 在 [dailyDialogueOrchestration.md](file:///Users/mac/Desktop/育见-2/prompts/front/dailyDialogueOrchestration.md) 和 [communicationRehearsal.md](file:///Users/mac/Desktop/育见-2/prompts/front/communicationRehearsal.md) 补 dossier v3 五段拆分取用

### 模块 2 · 交流 / 预演记忆联动

**P0 动作**：
- 在 [daily/index.tsx](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/daily/index.tsx) 补 `setStorageSync(REHEARSAL_HANDOFF_KEY, ...)`，从交流跳预演时带 retrievalPack 摘要或最近 entryFacts
- 在 [rehearsal/index.tsx](file:///Users/mac/Desktop/育见-2/miniprogram/src/pages/rehearsal/index.tsx) end 步骤接 endData.likelyTriggeredMechanisms / avoidPhrases / usedProfileEvidence，不只取前 3 条 join

**P1 动作**：
- 预演 analyze：校验 SP 必须引用至少 1 条用户事实（已有硬下限，需验证执行）
- 任务保存：确认 `tonightTaskGenerator` 读记忆

### 模块 3 · 异步 Job 与 UI 时序

**P1 动作**：
- 画像 Tab：`panelsReady` / `refreshedAt`；Job 未完成时 L3 旧文 +「整理中」
- `deep_mechanism` 完成后触发 `daily-refresh` 或 hub 失效缓存（可选）
- 交流结束提示「理解加深」仅在实际写回后

### 模块 4 · 观测与验收脚本

**P2 动作**：
- 扩展 `scripts/audit-memory-contract.mjs`：输出利用率 JSON
- 新增抽检：`scripts/sample-daily-prose.mjs` 类工具对比 facts 与输出
- 小尹语料全链路：`CORPUS_LIMIT=n npm run test:xiaoyin-corpus`
- 修复 THEORY_CARDS 文档注释（15×9 → 20×7）

### 模块 5 · 清理 dead write

**P2 动作**：
- 审计 `saveEnrichedHandbookCandidate` 是否真有 reader，若无则删
- 审计 `deep_mechanism_handoffs` 是否需要前台 reader，若不需要则降级为纯审计层

---

## Part 4 · 落地优先级

| P | 项 | 负责层 | 断点 |
|---|-----|--------|------|
| P0 | hidden payload 保留 retrievalPack | BFF | 1 |
| P0 | 预演 handoff 写入 + 带记忆摘要 | 小程序 + BFF | 2 |
| P0 | 预演 end 步骤接 endData 字段 | 小程序 | 3 |
| P0 | 建档结果页 Hero 读 snapshot | 小程序 | 4 |
| P0 | enrich tensions 卡翻译或不兜底 | BFF | 5 |
| P1 | fillDailySectionCopy taskTitle 接线 or 删 | BFF | 6 |
| P1 | enrich 静态空话模板清理 | BFF | 7 |
| P1 | 「主1/次2」禁止词同步 | prompts | 8 |
| P1 | dossier v3 五段拆分补全 | prompts | 9 |
| P1 | parentFacingStyle 编入 dailyPortraitRefresh | prompts | 10 |
| P1 | HubPayload 未消费字段接线 or 删 | 小程序 | 11 |
| P1 | deep/evidence/verify 读 pendingHypothesesList | 小程序 | 12 |
| P1 | daily thinkingChips fallback 基于 profile | 小程序 | 13 |
| P1 | daily 回传 retrievedContextSnapshot | 小程序 + BFF | 14 |
| P2 | THEORY_CARDS 文档注释修正 | 后端 | 15 |
| P2 | profileChipPanels 概念清理 | 文档 | 16 |
| P2 | deep_mechanism_handoffs reader 审计 | 后端 | 17 |
| P2 | saveEnrichedHandbookCandidate reader 审计 | 后端 | 18 |

---

## Part 5 · 验收标准（育见可核验）

1. **交流**：`turn_events.retrievedContextSnapshot` 含 `entryFacts`；prose 抽检含用户原话或事实；hidden section payload 含 retrievalPack
2. **画像 Tab**：`portraitCards` 六卡 summary 非占位；`refreshedAt` 随交流/进 Tab 更新；tensions 卡无学术 title
3. **chip 页**：deep/evidence/verify 读 `pendingHypothesesList`；无「主1/次2」压缩串
4. **预演**：handoff 带 retrievalPack 摘要；end 步骤文案含该用户短板/场景（非通用话术）
5. **建档结果**：Hero 文案含 snapshot.coreJudgment 摘要
6. **契约**：`npm run audit:fullchain` + `test-frontend-read-pack` 通过
7. **小尹语料**：`test:xiaoyin-corpus` 全链路 profile 阶段 `chipPanelFields` 有值

---

## 相对原稿的主要修正

| 原稿说法 | 育见实情 |
|----------|----------|
| Redis 短期 + MySQL 画像 | PostgreSQL `memory_layer_items` 24 层 + 独立表 |
| 全新 MemoryAdvisor | 已有 `frontend-read-pack` + router + Job 链 |
| 画像/预演「全静态模板」 | 画像有 daily-refresh 双 Agent + enrich 问题；预演 end 步骤才是真 hardcode |
| 深度思考 0% 用记忆 | 后台 deep_mechanism_review 读全量；前台展示层未充分消费 |
| 利用率 <5% 一刀切 | 分场景：交流中高、画像中、预演低、建档低 |
| profileChipPanels SP 存在 | 已于 2026-07-14 20:55 删除，子页改读 portraitCards |
| THEORY_CARDS 15×9 | 代码实际 20 张 × 7 rich 字段 |
| memory_write 日桶链式 deep_mechanism | 代码已改，仅 episode_ingest 链式触发 |
