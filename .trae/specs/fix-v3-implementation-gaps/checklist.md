# Checklist · 修复 v3 实施 Gap

## P0 致命（v3 核心机制）
- [ ] dossier schema 加 predictions[].status（unverified/failed/verified），portraitSynthesizer 产出时初始化 unverified
- [ ] user_tasks 加 linkedPredictionId 字段，任务 feedback 未达预期时对应 prediction status=failed
- [ ] shouldReconceptualize 增 checkPredictionFailure：任一 prediction failed → 触发 L2
- [ ] pipeline.ts portraitSynthesizer 调用入参加 failedPredictions[]
- [ ] portraitSynthesizer SP 补「failedPredictions 非空时 changeLog 显式说明 prediction X 失败 → 调整 Y」
- [ ] 反证≥2 触发对应 protective 的 prediction status=failed（联动）
- [ ] should-reconceptualize.ts 删除关键词 regex（/拖|作业|手机|顶嘴|沉默/）
- [ ] checkInterventionFailed 用 user_tasks status=completed_but_unsatisfied 或 feedback=未达预期
- [ ] checkRepeatedTheme 用 turn_events 按 matchedMechanisms/protective.id 聚类，同主题≥3 次
- [ ] intervention_failed 命名与实现对齐（return reason: 'intervention_failed', failedTaskId, repeatedTheme）
- [ ] portraitSynthesizer SP 补「intervention_failed 时提示前一版假设 T 干预无效，重新审视维持因素」
- [ ] DBA 核对生产库 DATABASE_URL 密码（ECONNREFUSED/password failed 已修）
- [ ] 拉真实家庭聚合结构（layer_name 计数/entryType 分布/factType 分布，无原始文本）
- [ ] portrait-real-data-validation.md 写入真实结构校验结果
- [ ] 确认 daily_updates.classification=counter_evidence 字段真实存在有数据
- [ ] portraitSynthesizer SP 含 8 标签 ↔ layer_name 映射表
- [ ] SP 硬规则「来源标签必在 8 个之内，禁止自创」
- [ ] 映射表 layer_name 经 Task 3 真实数据验证存在

## P1 重要（契约/字段一致性）
- [ ] router.ts:248-249 有 dossier 时兜底 slice(0,8)（原 3）
- [ ] npm run test:contracts 验证 slice 一致
- [x] read-contract.md 开篇「机制人话卡≤20」→ 8（Trae 已改 L14）
- [x] read-contract.md 契约表 entryFacts 40 → 80（Trae 已改 L29）
- [x] read-contract.md 全文无其他 20/40 漂移（Trae 已 grep 验证无残留）
- [x] portraitSynthesizer.md fivePs 段补「confidence: 0.X（N/M 场景现）」逐字段模板（Trae 已改 L55）
- [ ] db.ts 确认 memory_layer_items 支持 dossier_v{n} 历史版本（item_id 唯一 + JSON data）
- [ ] 若需 migration DDL 已补；若 JSON 够则文档说明
- [ ] getDossierHistory 能查回所有版本

## P0-4 SP 部分（Trae 已做，layer_name 待 Cursor P0-3 验证）
- [x] portraitSynthesizer SP 含 8 标签 ↔ layer_name 映射表（Trae 已加 L59-72）
- [x] SP 硬规则「来源标签必在 8 个之内，禁止自创」（Trae 已加 L74）
- [ ] 映射表 layer_name 经 Task 3 真实数据验证存在（Cursor P0-3 后做）

## P2 优化（token/质量）
- [ ] parent-facing-copy.ts visible section 路径改薄（dossierSlice 优先 + 精简包）
- [ ] 完整 retrievalPack 仅 dossierSlice 缺失时兜底
- [ ] visible section prose 质量不降（人工验收）
- [ ] Cursor commit（用户确认后，[cursor] 前缀 + push）

## P3 验证
- [ ] npm run typecheck exit 0
- [ ] npm run lint exit 0
- [ ] npm run test:contracts 通过（slice 一致 + dossierSlice 填充）
- [ ] 模拟 prediction 失败触发 L2（造 user_tasks feedback=未达预期 + linkedPredictionId，shouldReconceptualize 触发）
- [ ] 模拟 intervention_failed（任务未达预期 + 同主题 turn_events ≥3，触发）
- [ ] evidenceSummary 标签全在 8 个之内（造 dossier 验收）
- [ ] 远程 deploy build ready:true

## 检察官放行标准
- [ ] P0 全部 ✅（v3 核心机制不再空转）
- [ ] P1 全部 ✅（契约一致）
- [ ] P3 验证全过
- [ ] P2 可后置但 Task 9 建议本轮做（token 收益）
