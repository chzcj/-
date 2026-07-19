# Tasks · 修复 v3 实施 Gap

## P0 · 致命（v3 核心机制空转，必修）

- [ ] Task 1: 接 prediction 失败 → L2 重概念化链路
  - [ ] SubTask 1.1: dossier schema 加 `predictions[].status` 字段（unverified/failed/verified），portraitSynthesizer 产出时初始化 unverified
  - [ ] SubTask 1.2: `user_tasks` 加 `linkedPredictionId` 字段（任务关联 prediction）；任务 feedback 标记未达预期时，对应 prediction status=failed
  - [ ] SubTask 1.3: `shouldReconceptualize.ts` 增 `checkPredictionFailure(tenant)`：读 dossier.predictions，任一 status=failed → 返回 `{ should: true, reason: 'prediction_failed', failedPredictionId }`
  - [ ] SubTask 1.4: `pipeline.ts` portraitSynthesizer 调用入参加 `failedPredictions[]`（从 shouldReconceptualize 返回值传）
  - [ ] SubTask 1.5: portraitSynthesizer SP 补「failedPredictions 非空时，changeLog 必显式说明 prediction X 失败 → 调整 Y」
  - [ ] SubTask 1.6: 反证≥2 也触发对应 protective 的 prediction status=failed（联动）
- [ ] Task 2: 修 intervention_failed 真实监测（废弃关键词 regex）
  - [ ] SubTask 2.1: `should-reconceptualize.ts` 删除 `/拖|作业|手机|顶嘴|沉默/` regex 路径
  - [ ] SubTask 2.2: 加 `checkInterventionFailed(tenant)`：读近 14 天 user_tasks status=completed_but_unsatisfied 或 feedback=未达预期
  - [ ] SubTask 2.3: 加 `checkRepeatedTheme(tenant)`：近 30 条 turn_events 按 `retrievedContextSnapshot.matchedMechanisms` 或 dossier.protective.id 聚类，同主题≥3 次
  - [ ] SubTask 2.4: 两条件同时满足 → `{ should: true, reason: 'intervention_failed', failedTaskId, repeatedTheme }`
  - [ ] SubTask 2.5: portraitSynthesizer SP 补「intervention_failed 时被提示前一版假设的 T 干预无效，重新审视维持因素」
- [ ] Task 3: Task 0 真实数据拉取
  - [ ] SubTask 3.1: DBA 核对生产库 `~/yujian/.env.local` DATABASE_URL 密码（本地 ECONNREFUSED / password failed）
  - [ ] SubTask 3.2: 跑只读 SQL 拉 memory_layer_items 最丰富家庭的聚合结构（按 layer_name 计数、entryType 分布、factType 分布，不拉原始文本）
  - [ ] SubTask 3.3: 验证 familyStruct/fivePs/sceneReadings 能否被真实数据填充，写入 `.trae/documents/portrait-real-data-validation.md`（本地不入库）
  - [ ] SubTask 3.4: 确认 `daily_updates.classification=counter_evidence` 字段真实存在且有数据（否则 P0-2 反证判定也要改）
- [ ] Task 4: evidenceSummary 标签 ↔ layer_name 对照表
  - [ ] SubTask 4.1: portraitSynthesizer SP 加映射表（8 个标签：作业/日常/沟通/家庭/情绪模块 + 妈妈/孩子原话 + 任务反馈，对应 layer_name）
  - [ ] SubTask 4.2: SP 加硬规则「来源标签必在 8 个之内，禁止自创」
  - [ ] SubTask 4.3: 用 Task 3 真实数据验证映射表 layer_name 真实存在

## P1 · 重要（契约/字段一致性）

- [ ] Task 5: router.ts matchedMechanisms slice 3→8
  - [ ] SubTask 5.1: `router.ts:248-249` 有 dossier 时兜底 slice(0,3) → slice(0,8)，与 MATCHED_MECHANISMS_CARD_LIMIT 一致
  - [ ] SubTask 5.2: 跑 `npm run test:contracts` 验证 slice 一致
- [ ] Task 6: read-contract.md 文档漂移修正
  - [ ] SubTask 6.1: 开篇「机制人话卡≤20」→ 8
  - [ ] SubTask 6.2: 契约表 entryFacts 40 → 80（对齐 frontend-read-pack.ts:59）
  - [ ] SubTask 6.3: 全文 grep 「≤20」「40」确认无其他漂移
- [ ] Task 7: fivePs SP 补跨场景备注模板
  - [ ] SubTask 7.1: portraitSynthesizer.md fivePs 段补「confidence: 0.X（N/M 场景现）」逐字段模板，与 familyStruct 一致
  - [ ] SubTask 7.2: 附录 A 样例 fivePs 已是此格式，SP 模板对齐样例
- [ ] Task 8: db.ts schema 确认
  - [ ] SubTask 8.1: 核对 `memory_layer_items` 表结构是否支持 dossier_v{n} 历史版本（item_id 唯一性 + JSON data 字段）
  - [ ] SubTask 8.2: 若需 migration DDL（如加 schemaVersion 索引），补 DDL；若 JSON data 够则文档说明
  - [ ] SubTask 8.3: 验证 getDossierHistory 能按 item_id=dossier_v{n} 查回所有版本

## P2 · 优化（token/质量，可后置）

- [ ] Task 9: parent-facing-copy visible section payload 改薄
  - [ ] SubTask 9.1: `parent-facing-copy.ts:85-95` 当前仅全 hidden 改薄；visible section 路径也改「dossierSlice 优先 + 精简包」
  - [ ] SubTask 9.2: 完整 retrievalPack 仅在 dossierSlice 缺失时兜底
  - [ ] SubTask 9.3: 人工验收 visible section prose 质量不降（dossierSlice 够用）
- [ ] Task 10: Cursor commit（等用户确认）
  - [ ] SubTask 10.1: 用户确认后，按 P0→P1→P2 顺序 commit
  - [ ] SubTask 10.2: `[cursor]` 前缀 + 简要说明，push origin master

## P3 · 验证

- [ ] Task 11: 三轮验证
  - [ ] SubTask 11.1: `npm run typecheck` + `npm run lint`
  - [ ] SubTask 11.2: `npm run test:contracts`（slice 一致性 + dossierSlice 填充）
  - [ ] SubTask 11.3: 人工验收：模拟 prediction 失败触发 L2（造一条 user_tasks feedback=未达预期 + linkedPredictionId，看 shouldReconceptualize 是否触发）
  - [ ] SubTask 11.4: 人工验收：模拟 intervention_failed（造一条任务未达预期 + 同主题 turn_events ≥3，看触发）
  - [ ] SubTask 11.5: 人工验收：evidenceSummary 标签全在 8 个之内（造一个 dossier 看标签）
  - [ ] SubTask 11.6: 远程 deploy build ready:true

# Task Dependencies

- Task 1（prediction 接线）依赖 Task 2（intervention_failed 真实实现）——两者都改 shouldReconceptualize，避免冲突
- Task 3（真实数据）独立先行，结果校验 Task 4（标签对照）+ Task 1（反证字段确认）
- Task 4 依赖 Task 3（需真实 layer_name 验证映射表）
- Task 5/6/7/8 互相独立可并行
- Task 9（visible 改薄）依赖 Task 1-4 完成（dossierSlice 稳定后再改薄）
- Task 10（commit）最后，依赖所有 Task 完成
- Task 11（验证）依赖所有 Task 完成
