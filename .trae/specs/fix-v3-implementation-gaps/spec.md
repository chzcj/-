# 修复 v3 实施 Gap Spec

## Why

build-integrative-family-dossier spec 已由 Cursor 实施一轮（SP + 接线 + Job 链）。Trae 检察官按 25 项检查清单审查 Cursor 自述后，发现 **5 项 ❌ + 6 项 ⚠️**：v3 核心机制「prediction 失败 → L2 重概念化」SP 写了但代码未接（prediction 是死字段）；shouldReconceptualize 的「干预无效」用关键词 regex 冒充，非真实任务 feedback 监测；Task 0 真实数据未拉，evidenceSummary 标签未对照 layer_name（臆想风险）；多处 slice/文档漂移。这些 gap 不修，v3 画像机制是空转的。

## What Changes

- **P0-1 接 prediction 失败 → L2 链路**：`shouldReconceptualize` 增读 `pending_prediction_results`（新记忆层或 user_tasks.feedback 关联），prediction 失败时触发 L2，不再只靠 counter_evidence/关键词/指纹。
- **P0-2 修 intervention_failed 真实实现**：废弃关键词 regex（`/拖|作业|手机|顶嘴|沉默/`），改用 `user_tasks` feedback 标记未完成 + `turn_events` 主题聚类（同主题≥3 次）。命名与实现对齐。
- **P0-3 Task 0 真实数据拉取**：DBA 核对生产库 DATABASE_URL 密码（本次连接 ECONNREFUSED/password failed），跑只读聚合 SQL（按 layer_name 计数/场景分布/证据类型，不拉原始文本），写入 `.trae/documents/portrait-real-data-validation.md`。
- **P0-4 evidenceSummary 标签 ↔ layer_name 对照表**：portraitSynthesizer SP 加「来源模块标签 ↔ memory_layer_items.layer_name」映射表，禁止臆想 layer 名。
- **P1-5 router.ts slice(0,3) → 8**：`router.ts:248-249` 有 dossier 时 matchedMechanisms 兜底 slice 从 3 改 8，与 digest-limits/frontend-read-pack 一致。
- **P1-6 read-contract.md 文档漂移修正**：开篇「机制人话卡≤20」改 8；契约表 entryFacts 40 改 80（对齐代码）。
- **P1-7 fivePs SP 补跨场景备注模板**：portraitSynthesizer.md fivePs 段补「confidence 含跨场景备注」逐字段模板，与 familyStruct 一致。
- **P1-8 db.ts schema 确认**：核对 `memory_layer_items` 是否需 migration DDL 支持 dossier_v{n} 历史版本 + schemaVersion；若 JSON data 字段够则文档说明，若不够则补 DDL。
- **P2-9 parent-facing-copy visible section payload 改薄**：当前仅「全 hidden」改薄，visible section 路径仍走完整 buildDailyProsePayload；改为 visible 也用 dossierSlice 优先 + 精简包。
- **P2-10 Cursor commit**：等用户确认后 commit（用户明示「别改代码」本轮不动）。

## Impact

- **Affected specs**：`build-integrative-family-dossier`（本 spec 是其修复 delta）、`docs/contracts/read-contract.md`、`docs/product/deep-modeling.md`（如需补 prediction 失败机制说明）
- **Affected code**：
  - `src/lib/server/memory/dossier/should-reconceptualize.ts`（P0-1, P0-2 重写判定逻辑）
  - `src/lib/server/memory/database-manager.ts`（P0-1 加 pending_prediction_results 读取；P0-3 加聚合查询函数）
  - `src/lib/server/memory/deep-mechanism/pipeline.ts`（P0-1 把 prediction 失败标记写入）
  - `prompts/background/portraitSynthesizer.md`（P0-4 加 layer_name 对照表；P1-7 补 fivePs 跨场景备注）
  - `src/lib/server/memory/retrieval/router.ts`（P1-5 slice 3→8）
  - `docs/contracts/read-contract.md`（P1-6 漂移修正）
  - `src/lib/server/db.ts`（P1-8 确认/补 DDL）
  - `src/lib/server/daily/parent-facing-copy.ts`（P2-9 visible 改薄）
- **契约不变**：`packages/contracts` DailyStreamEvent/DailySection 不动（P0-1 走记忆层，不改前台契约）

---

## ADDED Requirements

### Requirement: prediction 失败 → L2 重概念化接线

系统 SHALL 在 `shouldReconceptualize(tenant)` 中读取 prediction 失败标记，任一 prediction 失败即触发 L2 全量重概念化。

**机制**：
- `portraitSynthesizer` 产出 dossier 时，每条 prediction 带 `id`（pred_1）+ `text` + `status: unverified`
- prediction 失败标记来源（任一即可，按优先级）：
  1. `user_tasks.feedback` 标记「未达预期」且 task 关联某 prediction（通过 `task.linkedPredictionId`）
  2. 家长日常输入中显式否定（`turn_events` 文本含「没效果/还是老样子/试了没用」+ 上下文关联 prediction）
  3. 反证事实累计 ≥2 条针对同一 protective 功能（现有 counter_evidence 机制）
- `shouldReconceptualize` 读到任一 prediction `status: failed` → 返回 `{ should: true, reason: 'prediction_failed', failedPredictionId }`
- L2 重跑时 `portraitSynthesizer` 输入含 `failedPredictions[]`，SP 要求 changeLog 显式说明「prediction X 失败 → 调整 Y」

#### Scenario: prediction 失败触发 L2
- **WHEN** 家长反馈「T1 不催那晚仍拖」（pred_1 失败）+ user_tasks 标记未达预期
- **THEN** shouldReconceptualize 返回 `{ should: true, reason: 'prediction_failed', failedPredictionId: 'pred_1' }`
- **AND** portraitSynthesizer 全量重跑，changeLog 含「pred_1 失败 → PR_t1 降权/移除」
- **AND** 旧 dossier 版本保留

#### Scenario: prediction 未失败不触发
- **WHEN** 所有 prediction status=unverified，无反证，无指纹变化
- **THEN** shouldReconceptualize 返回 `{ should: false }`，走日桶去重

### Requirement: intervention_failed 真实监测（废弃关键词 regex）

系统 SHALL 用结构化字段监测「干预无效」，禁止用 `/拖|作业|手机|顶嘴|沉默/` 关键词 regex 冒充。

**机制**：
- `user_tasks` 表读取：近 14 天 status=completed_but_unsatisfied 或 feedback 含「未达预期」的任务
- `turn_events` 主题聚类：近 30 条 turn_events 按 `retrievedContextSnapshot.matchedMechanisms` 或 dossier.protective.id 聚类，同主题（同一 protective 或同一 perpetuating）≥3 次即「同主题反复」
- 两个条件同时满足 → `intervention_failed: true`
- 命名与实现对齐：`shouldReconceptualize` 返回 `{ reason: 'intervention_failed', failedTaskId, repeatedTheme }`

#### Scenario: 真实干预无效触发 L2
- **WHEN** T1 任务 feedback=未达预期 + 近 30 条 turn_events 中针对 PR_t1 的输入 ≥3 次
- **THEN** shouldReconceptualize 返回 `{ should: true, reason: 'intervention_failed', failedTaskId: 'T1', repeatedTheme: 'PR_t1' }`
- **AND** portraitSynthesizer 被提示「前一版假设的 T1 干预无效，重新审视是否漏了维持因素」

### Requirement: evidenceSummary 标签 ↔ layer_name 对照表

`portraitSynthesizer` SP SHALL 含「来源模块标签 ↔ memory_layer_items.layer_name」映射表，禁止 LLM 臆想 layer 名。

**映射表**（SP 内固化，LLM 必须从这些标签选，不得自创）：

| SP 来源标签 | memory_layer_items.layer_name | 说明 |
|------------|------------------------------|------|
| 作业模块 | entry_evidence_packs（entryType=homework） | 四模块作业采集 |
| 日常模块 | entry_evidence_packs（entryType=daily）/ daily_updates | 日常节奏/手机 |
| 沟通模块 | entry_evidence_packs（entryType=communication） | 亲子沟通 |
| 家庭模块 | entry_evidence_packs（entryType=family） | 家庭结构 |
| 情绪模块 | entry_evidence_packs（entryType=final）/ turn_events | 情绪压力 |
| 妈妈原话 | turn_events / parent_narrative_patterns | 家长原话 |
| 孩子原话 | fact_atoms（factType=child_quote，若高价值则 evidence_episodes atoms） | 孩子原话 |
| 任务反馈 | user_tasks | 任务执行反馈 |

#### Scenario: evidenceSummary 标签合规
- **WHEN** portraitSynthesizer 产出 fivePs.P1.evidenceSummary
- **THEN** 来源标签必在上表 8 个之内
- **AND** 不出现「学习模块」「行为模块」等臆想标签

---

## MODIFIED Requirements

### Requirement: shouldReconceptualize 判定逻辑（原 build-integrative-family-dossier spec Task 7.4）

原 spec 要求「反证≥2/干预无效/指纹变化/10轮/四模块齐」触发 L2。本次修复明确：
- **反证≥2**：查 `daily_updates` classification=counter_evidence（保留，但需确认 layer_name 真实存在，见 P0-3 真实数据校验）
- **干预无效**：废弃关键词 regex，改用 user_tasks + turn_events 主题聚类（见新增 Requirement）
- **prediction 失败**：新增触发源（见新增 Requirement）
- **指纹变化**：保留 hash 比较
- **10轮/四模块齐**：保留现有

### Requirement: router.ts matchedMechanisms slice 一致性（原 spec Task 4）

原 spec 要求双 slice 统一为 8。Cursor 实施时 `router.ts:248-249` 在有 dossier 时 slice(0,3)。本次修复：有 dossier 时兜底也 slice(0,8)（与 digest-limits.ts MATCHED_MECHANISMS_CARD_LIMIT 一致）。

### Requirement: parent-facing-copy hidden payload 改薄（原 spec Task 13.4 / R1）

原 spec 要求 hidden payload 改薄。Cursor 仅在「全 hidden」场景改薄，visible section 路径仍走完整 buildDailyProsePayload。本次修复：visible section 路径也用「dossierSlice 优先 + 精简包」，完整 retrievalPack 仅在 dossierSlice 缺失时兜底。

### Requirement: read-contract.md 文档一致性（原 spec Task 14.1）

原 spec 要求 matchedMechanisms → dossierSlice 主源 + 兜底 8。Cursor 实施后 read-contract.md 仍存在两处漂移：开篇「机制人话卡≤20」、契约表 entryFacts 40。本次修复：开篇改 8，entryFacts 改 80（对齐 frontend-read-pack.ts:59）。

### Requirement: portraitSynthesizer fivePs 跨场景备注（原 spec 减冗余决策）

原 spec 要求「每因素带 confidence 0-1 含跨场景备注」。Cursor 实施 familyStruct 有跨场景备注模板，fivePs 没有。本次修复：fivePs SP 补「confidence: 0.X（N/M 场景现）」逐字段模板。

---

## REMOVED Requirements

### Requirement: 关键词 regex 冒充 intervention_failed
**Reason**：`shouldReconceptualize` 用 `/拖|作业|手机|顶嘴|沉默/` ≥3 次冒充「干预无效」，名实不符，且关键词命中率高但语义无关（家长正常描述也会触发）。
**Migration**：废弃 regex 路径，改用 user_tasks + turn_events 主题聚类（见新增 Requirement）。旧 regex 代码删除。

---

## 附：检察官判定汇总（25 项 + 收尾）

### 风险 1 · v3 链路对齐（4 项）
- 1.1 dossier v3 字段引用：✅（parentFacingStyle/digest-builder/llm-digest-builder 都改；legacy fallback 是设计意图）
- 1.2 portraitSynthesizer 在 Job 内取代：✅（pipeline.ts L514-527，flag 控制，失败回退，没新建 Job）
- 1.3 dossier_patch 挂 memory_write 链尾：✅（queue.ts L149-172，非反证轮，没新建定时器）
- 1.4 shouldReconceptualize：⚠️（挂入口合规，但 intervention_failed 用关键词 regex 冒充 → P0-2 修）

### 风险 2 · SP 深度（5 项）
- 2.1 七段结构：✅（portraitSynthesizer.md L47-79）
- 2.2 fivePs 字段要求：⚠️（有 confidence+evidenceSummary，但缺跨场景备注模板 → P1-7 修）
- 2.3 workingHypothesis ≥2 predictions + 失败触发：❌（SP 有「≥2」未写死；代码 shouldReconceptualize 没读 prediction 失败 → P0-1 修）
- 2.4 dossierPatcher 约束：✅（SP L9/L23-31/L33-40，代码一致）
- 2.5 前台要方法不沉默：✅（SP + advice_from_dossier 枚举 + orchestration 路由）

### 风险 3 · 契约（4 项）
- 3.1 read-contract + slice 统一 8：⚠️（多处 8，但 router.ts:249 有 dossier 时 slice(0,3)；read-contract 开篇 20/entryFacts 40 漂移 → P1-5/P1-6 修）
- 3.2 daily-stream 契约：✅（没改）
- 3.3 dossierSlice 填充对齐：✅（router 填 + frontend-read-pack 读 + 编排注入）
- 3.4 字段流转表：✅（4 个字段 producer/storage/consumer 列了）

### 风险 4 · 数据库（4 项）
- 4.1 拉真实数据：❌（没拉，本地 ECONNREFUSED → P0-3 修）
- 4.2 evidenceSummary 标签 vs layer_name：❌（没做对照表，臆想风险 → P0-4 修）
- 4.3 deep_model_digest schema v2 在 db.ts：⚠️（在 digest-store 不在 db.ts，没确认 migration → P1-8 修）
- 4.4 shouldReconceptualize 查表字段：❌（反证查 classification 不是 layer_name；同主题是 regex 不是结构化字段；prediction 失败没实现 → P0-1/P0-2 修）

### 风险 5 · 中间层断层（7 项）
- 5.1 ecosystemClassifier → theoryMatcher：✅
- 5.2 theoryMatcher → portraitSynthesizer：✅（THEORY_CARDS 注入两 Agent，theoryCardId 不进输出）
- 5.3 previousDossier + changeLog：✅（pipeline.ts L514-522 输入含 previousDossier）
- 5.4 dossierPatcher 输入：✅（含 existing + newFacts）
- 5.5 structuralRiskExtractor：✅（仍调用，输出 structuralTensions；双轨并行可接受）
- 5.6 digestBuilder 投影：✅（优先 dossier.integratedSynthesis，fallback topMechanism.description）
- 5.7 hidden payload 改薄：⚠️（仅全 hidden 改薄，visible 路径未改薄 → P2-9 修）

### 收尾自检（3 项）
- SP 深度样例：✅（familyBriefUpdater 有链路/字段/样例/反模式/schema）
- 字段 producer/storage/consumer：✅（dossierSlice 列了）
- typecheck + lint：✅（exit 0；build 本机失败但远程 deploy 成功 ready:true）

### 总计
- ✅ 16 项
- ⚠️ 6 项（1.4, 2.2, 3.1, 4.3, 5.7, +build 本机）
- ❌ 5 项（2.3, 4.1, 4.2, 4.4, +1.4 的 intervention_failed 实现）

**结论**：v3 骨架接对了（16✅），但 **5 个 ❌ 全在「机制空转」**——prediction 失败没接、数据库没拉、臆想标签、干预无效冒充、查表字段不对。这些不修，v3 画像机制是空壳。⚠️ 6 项是契约/字段漂移，影响一致性。建议 P0 必修后再进下一阶段，P1 随 P0，P2 可后置。
