# Checklist · 优化版（减冗余 + 复用链路）

> 实施顺序与门禁见 [execution-playbook.md](./execution-playbook.md)

## Execution Gates（每 PR 合并前）

- [ ] PR 描述含 Goal / Non-goals / Files≤5 / Flag / Rollback
- [ ] 未改 voice/ASR/RecorderManager 锁定文件
- [ ] 未顺手 deploy / 未未授权 commit
- [ ] `npm run typecheck` + `npm run build` 通过
- [ ] 若动 read-pack/router/digest：契约脚本通过（test-frontend-read-pack + audit-memory-contract）
- [ ] 若动 prompt：audit-prompt-registry.mjs 通过
- [ ] grep 附录 B consumer 无 orphan 字段
- [ ] PORTRAIT_V3=0 回退路径 smoke（若已引入 flag）

## Phase 0 真实数据校验
- [ ] 生产库 DATABASE_URL 密码已核对（DBA）
- [ ] 已拉最丰富家庭聚合结构（layer_name 计数/场景分布/证据类型分布），无原始可识别文本
- [ ] 附录 A familyStruct/fivePs/sceneReadings 经真实数据校验可填充
- [ ] 校验结果写入 .trae/documents/portrait-real-data-validation.md（本地不入库）

## Phase B 低风险工程
- [ ] PARENT_INPUT_WINDOW=100 常量定义，pipeline.ts 喂 LLM 用同窗口 + 单条 trunc 200
- [ ] THEORY_CARDS 从 user payload 移到 theoryMatcher system 尾部，logCacheHit 命中率提升
- [ ] deep job 5 路触发加 reason 标注，租户级 15min debounce 生效
- [ ] 日桶触发只跑 digest_update，不跑 4 步 deep 链
- [ ] matchedMechanisms 双 slice 统一为 8（router.ts formatMatchedMechanismCards + frontend-read-pack.ts）

## Phase C 核心重构
- [ ] theory-cards.ts 为 15 张 × 9 字段，与报告 docx 一致，旧 10 张降级附录
- [ ] MVP 第一批 8 张先行
- [ ] deep_model_digest schema v2：item_id=dossier_v{n} 历史版本追加 + item_id=latest 指向最新 + schemaVersion 字段
- [ ] getLatestDossier / getDossierHistory 可查演进
- [ ] portraitSynthesizer 在 deep_mechanism_review Job 内取代 mechanismSynthesizer（flag 控制）
- [ ] portraitSynthesizer 产出 7 段 + internal 段，每因素带 confidence(含跨场景备注) + evidenceSummary(人话+来源模块)
- [ ] portraitSynthesizer 输出无 theoryCardId/mechanismName/overallStrength
- [ ] portraitSynthesizer 输出无术语（稳态/强制循环/homeostasis/三角化/SDT 等）
- [ ] workingHypothesis 含 ≥2 条可证伪 predictions，失败触发重概念化
- [ ] interventionTargets 每条引用 perpetuating id + prediction + obstacle（obstacle 并入不单列）
- [ ] shouldReconceptualize 并入 runDeepMechanismReview 入口，反证≥2/干预无效/指纹变化时跳过日桶强制全量
- [ ] dossierPatcher 在 memory_write 链尾触发（非反证轮）
- [ ] dossierPatcher 仅改受影响段落，workingHypothesis 核心不变
- [ ] dossierPatcher 输出 changeLog
- [ ] episode atom 含 evidenceTier/ecologicalLayer/factRole
- [ ] digest 从 dossier 投影，mechanismNarrative ← integratedSynthesis
- [ ] dossierSlice 按本轮 query 切段落，ecologicalCalibration 不进 slice
- [ ] formatMatchedMechanismCards 仅 dossier 缺失时兜底

## Phase D 宪法契约前台
- [ ] deep-modeling.md §2/§7 不再强制"机制闭环五步链"
- [ ] deep-modeling.md 新增 §X 底稿更新机制（Level 1/Level 2）
- [ ] parentFacingStyle.md §三 引用 dossierSlice，弱化 interactionLoops
- [ ] parentFacingStyle.md §气质参照/果断与念读 字段名 mechanismNarrative→dossierSlice（R3）
- [ ] parentFacingStyle.md §禁止词 补 v3 术语禁令（R4）
- [ ] dailyDialogueOrchestration.md §1 同步
- [ ] prose-context.ts PACK_FIELD_GUIDE 加 dossierSlice 引导，matchedMechanisms 标"兜底用"
- [ ] parent-facing-copy.ts hidden payload 改薄，不带完整 retrievalPack（R1）
- [ ] prose-section-stream.ts taskTitle 取 interventionTargets[0].action（R5）
- [ ] parentFacingStyle + parentFacingCopy 改"要方法就沉默"（R6）：区分要方法/信息不够、ask_advice proseMode、advice 放宽 150-250 字允许 1-2 靶点带 prediction+obstacle
- [ ] orchestration/pipeline.ts ask_advice 路由加 advice_from_dossier 枚举，区分要解释/要方法（R6-S4）
- [ ] read-contract.md matchedMechanisms → dossierSlice 主源 + 兜底 8
- [ ] DESIGN.md 画像 Tab 来源 matrix → dossier 投影
- [ ] PORTRAIT_V3 flag 默认关，开启走 dossier 关闭回退旧矩阵
- [ ] 旧 evidence_networks/built_profile_snapshots/deep_model_digest 不删不迁移

## 底稿深度验收（对照 spec 附录 A 优化版）
- [ ] 底稿含 familyStruct（亚系统/边界/层级/联盟，每项带 confidence+evidenceSummary 人话）
- [ ] 底稿含 fivePs，每因素带 confidence(0-1含跨场景备注) + evidenceSummary(人话+来源模块标签)
- [ ] sceneReadings 每场景列 protective 配比（引用 protective[].id）+ 主 perpetuating id
- [ ] workingHypothesis 无术语，含 ≥2 条可证伪 predictions
- [ ] interventionTargets 每条引用 perpetuating id + prediction + obstacle（并入此）
- [ ] alternativeReadings ≥2 条，各带 confidence + distinguishingEvidence
- [ ] integratedSynthesis 唯一散文段（200-400字），无术语，引用判断可追溯到 fivePs/familyStruct
- [ ] 底稿无 evidencePointers(ev_xxx)、crossSceneFrequency、openObservations、childQuotes 段、predictedObstacles 段
- [ ] 底稿无【待验证】【下一步看】元标签
- [ ] 底稿无 theoryCardId/mechanismName/overallStrength
- [ ] 底稿无"几股力"等无 evidenceSummary 的模糊判断
- [ ] 底稿覆盖整家（结构/5Ps/双亲/多场景），不只围绕单点问题
- [ ] 前端取用映射明确：daily/rehearsal/profile/tasks 各取哪些段落

## 更新机制验收
- [ ] 日常新事实触发 Level 1 patch（memory_write 链尾），workingHypothesis 核心不变，新版本追加
- [ ] 反证 ≥2 同功能触发 Level 2 重概念化（shouldReconceptualize），新 dossier changeLog 说明原因
- [ ] 干预无效（任务未完成 + 同主题输入 ≥3 次）触发 Level 2，回应"为什么无效"
- [ ] 旧 dossier 版本保留可查（getDossierHistory）
- [ ] 因素 ID 跨版本稳定（M1/PR_t1/T1 不变），置信度变化可追

## Phase E 三轮验证
- [ ] npm run typecheck 通过
- [ ] npm run lint 通过
- [ ] npm run build 通过
- [ ] cd miniprogram && npm run build:weapp 通过（契约不变应无影响）
- [ ] 人工验收：日常交流页 prose 不再贴卡，引用 dossierSlice 整合理解
- [ ] 人工验收：画像 Tab 卡片由 dossier 投影，不再从 matrix 猜六维
