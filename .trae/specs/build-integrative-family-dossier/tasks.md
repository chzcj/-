# Tasks · 优化版（复用现有链路）

> **实施必读**：[execution-playbook.md](./execution-playbook.md)（PR 切片 ≤5 文件、consumer 门禁、三轮验证、禁止 voice/deploy 顺手改）

## Phase 0 · 真实数据校验（前置）

- [ ] **PR-0** Task 0: 拉真实家庭数据校验底稿形态
  - [ ] SubTask 0.1: DBA 核对生产库 DATABASE_URL 密码（本次连接失败疑轮换）
  - [ ] SubTask 0.2: 跑只读 SQL 拉 memory_layer_items 最丰富家庭的聚合结构（按 layer_name 计数、场景分布、证据类型分布，不拉原始文本）
  - [ ] SubTask 0.3: 验证附录 A familyStruct/fivePs/sceneReadings 能否被真实数据填充，写入 `.trae/documents/portrait-real-data-validation.md`（本地不入库）

## Phase B · 低风险工程先行（可独立交付，每 SubTask = 1 PR）

- [ ] **PR-B1** Task 1: 统一家长输入窗口 100 条
  - [ ] SubTask 1.1: `database-manager.ts` 加常量 `PARENT_INPUT_WINDOW=100` + `PARENT_INPUT_TRUNCATE=200`
  - [ ] SubTask 1.2: `deep-mechanism/pipeline.ts` sharedContext `slice(-30)` → `slice(-100)` 每条 trunc 200
  - [ ] **Gate**: typecheck；grep 确认 fingerprint 与 dailyUpdates 同窗口
- [ ] **PR-B2** Task 2: THEORY_CARDS 进 system 前缀（cache）
  - [ ] SubTask 2.1: `pipeline.ts` 把 `{ecosystemMap, theoryCards}` 从 user 移到 theoryMatcher system 尾部
  - [ ] SubTask 2.2: 验证 `ark-agents.ts` logCacheHit 命中率提升
  - [ ] **Gate**: 仅改 theoryMatcher 调用路径；不改 dossier 行为
- [ ] **PR-B3** Task 3: deep job 触发去重 + reason 标注
  - [ ] SubTask 3.1: `jobs/queue.ts` 加租户级 debounce 15min 合并 pending deep job
  - [ ] SubTask 3.2: `turn-signal.ts` 5 路触发加 reason 字段
  - [ ] SubTask 3.3: 日桶触发改只跑 digest_update 不跑 4 步 deep 链
  - [ ] **Gate**: queue.ts 单 PR；日志可见 reason；debounce 不丢 10 轮 milestone
- [ ] **PR-B4** Task 4: matchedMechanisms 双 slice 统一
  - [ ] SubTask 4.1: `router.ts:245` formatMatchedMechanismCards slice 20 与 `frontend-read-pack.ts:82` slice 40 统一为 8
  - [ ] **Gate**: test-frontend-read-pack.mjs + audit-memory-contract.mjs

## Phase C · 核心重构（复用现有 Job 与存储，严格 PR 顺序 C1→C8）

- [ ] **PR-C1** Task 5: 重建 theory-cards.ts rich fields
  - [ ] SubTask 5.1: 按报告 docx 15 张 × 9 字段重建，保持卡名不重命名
  - [ ] SubTask 5.2: 报告未列的 10 张旧卡降级 SP 自检附录
  - [ ] SubTask 5.3: MVP 第一批 8 张先行
  - [ ] SubTask 5.4: SP 单源化（deepMechanismReview.md 不重复理论，引用代码）
  - [ ] **Gate**: 仅 theory-cards + registry；**不改** pipeline 主路径行为
- [ ] **PR-C2** Task 6: deep_model_digest schema v2（复用存储层，不新建表）
  - [ ] SubTask 6.1: `digest-store.ts` saveDeepModelDigest 加 `schemaVersion` 字段 + `item_id=dossier_v{n}` 历史版本追加 + `item_id=latest` 指向最新
  - [ ] SubTask 6.2: `getLatestDossier(tenant)` + `getDossierHistory(tenant)` 读取函数
  - [ ] SubTask 6.3: 类型 `FamilyUnderstandingDossier`（7 段 + internal + version + changeLog）
  - [ ] **Gate**: 读写函数单测或脚本；旧 latest 仍可读
- [ ] **PR-C3** Task 7a: portraitSynthesizer SP only（SubTask 7.1）
  - [ ] SubTask 7.1: `prompts/background/portraitSynthesizer.md`：要求 7 段、减冗余、去术语、交织、含 changeLog
  - [ ] **Gate**: audit-prompt-registry.mjs；对照 spec 附录 A 样例人工读
- [ ] **PR-C4** Task 7b: pipeline 接入 portraitSynthesizer（SubTask 7.2–7.4）
  - [ ] SubTask 7.2: `deep-mechanism/pipeline.ts:484` mechanismSynthesizer 调用替换为 portraitSynthesizer（flag 控制，旧链路保留兜底）
  - [ ] SubTask 7.3: 输入：全量证据 + 旧 dossier（作前一版假设）；输出：新 dossier
  - [ ] SubTask 7.4: shouldReconceptualize(tenant) 判定并入 `runDeepMechanismReview` 入口（pipeline.ts:316），反证≥2/干预无效/指纹变化时跳过日桶强制全量
  - [ ] **Gate**: PORTRAIT_V3 flag；off 路径 mechanismSynthesizer 不变
- [ ] **PR-C5a** Task 8a: dossierPatcher SP + Job 类型（SubTask 8.1–8.2）
  - [ ] SubTask 8.1: `prompts/background/dossierPatcher.md`：仅改受影响段落、不推翻核心、标注 changeLog
  - [ ] SubTask 8.2: `jobs/queue.ts` 加 `dossier_patch` Job 类型
- [ ] **PR-C5b** Task 8b: memory_write 链尾 + handler（SubTask 8.3–8.4）
  - [ ] SubTask 8.3: `write/decision-engine.ts` executeWritePlan 尾部，非反证轮链式 `enqueueJob('dossier_patch', ...)`
  - [ ] SubTask 8.4: dossierPatcher 读 latest dossier + 新事实 → patch → saveDeepModelDigest(item_id=dossier_v{n})
  - [ ] **Gate**: idempotency_key `dossier_patch:{traceId}`；L1 不改 workingHypothesis 核心（附录 C v2）
- [ ] **PR-C6** Task 9: episode_ingest 加证据元数据
  - [ ] SubTask 9.1: `episode/pipeline.ts` ExtractedAtom 加 evidenceTier/ecologicalLayer/factRole
  - [ ] SubTask 9.2: episodeExtractor SP 加元数据标注要求
  - [ ] **Gate**: 不改 daily episode 入队条件（除非同步改 memory-write.md）
- [ ] **PR-C7** Task 10: digest 投影改造（**必须与 pick-deep-model-digest 同 PR**）
  - [ ] SubTask 10.1: `digest-builder.ts` 从 topMechanism.description → 投影 dossier.integratedSynthesis + familyStruct 摘要
  - [ ] SubTask 10.2: `llm-digest-builder.ts` 同步
  - [ ] SubTask 10.3: `pick-deep-model-digest.ts` mechanismNarrative ← integratedSynthesis，新增 dossier 多段字段
  - [ ] **Gate**: grep 全部 `mechanismNarrative` consumer；profile hub / rehearsal 不 500
- [ ] **PR-C8** Task 11: dossierSlice 前台切片（**slicer + frontend-read-pack + router 同 PR**）
  - [ ] SubTask 11.1: 新建 `src/lib/server/memory/dossier/dossier-slicer.ts`：sliceForDaily/sliceForRehearsal/sliceForProfile/sliceForTasks
  - [ ] SubTask 11.2: `frontend-read-pack.ts` FRONTEND_READ_PACK_KEYS 加 dossierSlice
  - [ ] SubTask 11.3: `router.ts` buildDailyDialogueRetrievalPacket 填 dossierSlice
  - [ ] SubTask 11.4: formatMatchedMechanismCards 降级兜底（dossier 缺失才用）
  - [ ] **Gate**: test-frontend-read-pack.mjs；ecologicalCalibration 不进 slice；**此后才允许 Phase D 改 SP**

## Phase D · 前台对齐 + 宪法契约（依赖 PR-C8）

- [ ] **PR-D1** Task 12: 宪法修订
  - [ ] SubTask 12.1: `docs/product/deep-modeling.md` §2/§7 改"机制闭环"→"证据分层+整合底稿+理论隐身+增量更新"
  - [ ] SubTask 12.2: 新增 §X 底稿更新机制（Level 1/Level 2）
- [ ] **PR-D2** Task 13 core: 前台 SP 字段引用（SubTask 13.1–13.3）
  - [ ] SubTask 13.1: `prompts/core/parentFacingStyle.md` §三 matchedMechanisms → dossierSlice，弱化 interactionLoops；§气质参照/果断与念读 字段名 mechanismNarrative→dossierSlice.workingHypothesis/integratedSynthesis（R3）；§禁止词 补 v3 术语禁令（R4）
  - [ ] SubTask 13.2: `prompts/front/dailyDialogueOrchestration.md` §1 同步
  - [ ] SubTask 13.3: `prose-context.ts` PACK_FIELD_GUIDE 加 dossierSlice 引导，matchedMechanisms 标"兜底用"
- [ ] **PR-D3** Task 13 UX: R1/R5/R6（SubTask 13.4–13.7）
  - [ ] SubTask 13.4: `parent-facing-copy.ts` hidden payload 改薄（R1）
  - [ ] SubTask 13.5: `prose-section-stream.ts` taskTitle 改取 `dossierSlice.interventionTargets[0].action`（R5）
  - [ ] SubTask 13.6: `prompts/core/parentFacingStyle.md` + `prompts/front/parentFacingCopy.md` 改"要方法就沉默"（R6）——区分"要方法"与"信息不够"、引入 ask_advice proseMode、advice section 放宽 150-250 字允许 1-2 靶点带 prediction+obstacle、ask_advice 轮 prose 可含一个靶点 action
  - [ ] SubTask 13.7: `orchestration/pipeline.ts:347` `ask_advice && canExplain` 时 frontResponseType 从 `model_based_explanation` 改为 `advice_from_dossier`（新枚举），区分"要解释"与"要方法"（R6-S4）
  - [ ] **Gate**: 删 professional_perspective（R2）与 D2/D3 同批或 D3；人工测「要方法」不沉默
- [ ] **PR-D4** Task 14: 契约文档更新
  - [ ] SubTask 14.1: `docs/contracts/read-contract.md` matchedMechanisms → dossierSlice 主源 + 兜底 8
  - [ ] SubTask 14.2: `DESIGN.md` 画像 Tab 来源 matrix → dossier 投影
- [ ] **PR-D5** Task 15: Feature flag + 迁移
  - [ ] SubTask 15.1: `isPortraitV3Enabled()`（env PORTRAIT_V3 默认关）
  - [ ] SubTask 15.2: pickDeepModelDigestPack 优先 dossier，缺失回退旧 matrix
  - [ ] SubTask 15.3: 旧 evidence_networks/built_profile_snapshots/deep_model_digest 不删不迁移
  - [ ] **Gate**: PORTRAIT_V3=0 全链路回归；=1 附录 A 深度验收

## Phase E · 验证（**PR-E**，用户明确 deploy 时）

- [ ] **PR-E** Task 16: 三轮验证
  - [ ] SubTask 16.1: npm run typecheck + lint + build
  - [ ] SubTask 16.2: cd miniprogram && npm run build:weapp（契约不变应无影响）
  - [ ] SubTask 16.3: 人工验收 dossier 样例深度（对照 spec 附录 A 优化版）
  - [ ] SubTask 16.4: 验证更新机制：日常反馈走 L1 patch、反证触发 L2 重概念化、旧版本保留
  - [ ] SubTask 16.5: 验证前台 dossierSlice 按问题类型取段落、无理论名泄漏、无术语、无【待观察】
  - [ ] **Gate**: npm run deploy 仅在本 Task；HANDOFF 追加；**不改 voice**

# Task Dependencies

- Task 0（真实数据）独立先行，结果校验形态
- Task 1/2/3/4（Phase B）互相独立可并行
- Task 5（theory-cards）独立可并行
- Task 6（schema v2）是 Task 7/8 的依赖
- Task 7（portraitSynthesizer）依赖 Task 5 + Task 6
- Task 8（dossierPatcher）依赖 Task 6
- Task 9（episode 元数据）独立，提升 Task 7/8 输入质量
- Task 10（digest 投影）依赖 Task 6/7
- Task 11（dossierSlice）依赖 Task 6/10
- Task 12/13/14（宪法/SP/契约）依赖 Task 11 形态确认
- Task 15（flag）贯穿，每个改动点加 flag 分支
- Task 16（验证）最后；**PR-E 单独回合**

# Consumer 必查清单（改字段时 grep）

| 字段/层 | Producer | Consumers（改 producer 必 grep） |
|---------|----------|----------------------------------|
| dossier JSON | portraitSynthesizer / dossierPatcher | digest-store, digest-builder, pick-deep-model-digest, dossier-slicer |
| dossierSlice | dossier-slicer | frontend-read-pack, router, prose-context, parent-facing-copy, rehearsal/analyze |
| integratedSynthesis | portraitSynthesizer | digest-builder, pick-deep-model-digest, dailyPortraitRefresh |
| mechanismNarrative | digest 投影（legacy） | parentFacingStyle, parentFacingCopy, profile/hub, rehearsal/analyze |
| interventionTargets | portraitSynthesizer | dossier-slicer, prose-section-stream, tonight-task-agent |
