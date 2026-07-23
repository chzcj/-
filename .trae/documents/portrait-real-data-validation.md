# Portrait Real Data Validation (Task 0)

> 本地文档，不入库 Git。PII 保护：不记录原始家长/孩子文本。

## 执行摘要

| 项 | 状态 | 说明 |
|----|------|------|
| SubTask 0.1 DATABASE_URL | **✅ 已通** | 2026-07-18 根因：曾用 `~/yujian/.env.local`（过期密码）；正确路径 **`/home/ubuntu/apps/yujian/.env.local`**（与 PM2/deploy 一致）。 |
| SubTask 0.2 只读 SQL 聚合 | **✅ 已执行** | 见下文 layer 分布 + counter_evidence=34。 |
| SubTask 0.3 形态校验 | **✅ 映射表对齐** | 8 标签对应 layer 均存在于生产库；`dossier_v%` 尚无历史（PORTRAIT_V3 未开或未写版本）。 |

## 根因（2026-07-18 定位）

| 路径 | psql 结果 |
|------|-----------|
| `/home/ubuntu/apps/yujian/.env.local`（PM2 / deploy.sh） | ✅ `SELECT 1` 成功 |
| `~/yujian/.env.local`（旧目录） | ❌ password authentication failed |

- 两文件 `DATABASE_URL` 密码不同（线上 10 位 vs 旧 36 位）。
- `/api/readiness` 数据库正常（55 用户、4896+ memory）印证线上 env 正确。
- 旧 env 已备份为 `~/yujian/.env.local.bak.YYYYMMDD` 并在原文件顶部加废弃注释。

**正确连法（SSH）**

```bash
cd /home/ubuntu/apps/yujian
export $(grep ^DATABASE_URL= .env.local | xargs)
psql "$DATABASE_URL" -c "SELECT 1;"
```

**踩坑**：本机 Mac 的 `.env.local` 指向本机 127.0.0.1，非腾讯云；需 SSH 隧道或直接在服务器 psql。

---

## SubTask 0.2 · layer_name 分布（全库聚合）

```
 account_client_backup      |     5
 build_progress             |    32
 built_profile_snapshots    |    18
 child_basic                |    11
 child_structure_models     |    19
 cleaned_facts              |    42
 conditional_profiles       |    38
 daily_ui_snapshot          |    25
 daily_updates              |  1579
 deep_mechanism_handoffs    |    17
 deep_mechanism_turn_signal |    13
 deep_model_digest          |    31
 entry_evidence_packs       |    77
 evidence_networks          |    97
 growth_trajectory          |     4
 interaction_cycles         |   108
 parent_narrative_patterns  |    18
 pending_hypotheses         |   534
 profile_build_run          |     1
 raw_materials              |    20
 retrieval_indexes          |  1389
 turn_events                |   786
 user_tasks                 |    36
```

**counter_evidence**

```sql
SELECT COUNT(*) FROM memory_layer_items
 WHERE layer_name='daily_updates' AND (data->>'classification')='counter_evidence';
-- 结果: 34
```

**最丰富家庭（按 layer 条数 Top，不含 PII）**

| family_id (前缀) | child_id (前缀) | layer | n |
|------------------|-----------------|-------|---|
| fam_1781700316491 | child_…sfdd2v | retrieval_indexes | 504 |
| fam_1781700316491 | child_…sfdd2v | daily_updates | 399 |
| fam_1782029306412 | child_…66gcml | daily_updates | 399 |
| fam_1780644661390 | child_…aeegqa | turn_events | 271 |
| f_demo | c_demo | daily_updates | 186 |
| f_demo | c_demo | turn_events | 173 |

**dossier 版本历史**

```sql
SELECT item_id FROM memory_layer_items
 WHERE layer_name='deep_model_digest' AND item_id LIKE 'dossier_v%';
-- 结果: 0 行（当前仅 item_id='latest'；PORTRAIT_V3 开且 saveDossierVersion 跑过后应有 dossier_v{n}）
```

**fact_atoms 表**：存在（`EXISTS = true`），供「孩子原话」标签数据源。

---

## SubTask 0.3 · 8 标签 ↔ layer_name 映射表验证

对照 `portraitSynthesizer.md` L59-72：

| 来源标签 | 映射 layer / 表 | 生产库存在？ |
|----------|-----------------|-------------|
| 作业模块 | entry_evidence_packs (homework) | ✅ entry_evidence_packs=77 |
| 日常模块 | entry_evidence_packs (daily) / daily_updates | ✅ daily_updates=1579 |
| 沟通模块 | entry_evidence_packs (communication) | ✅ 同上 pack 层 |
| 家庭模块 | entry_evidence_packs (family) | ✅ 同上 |
| 情绪模块 | entry_evidence_packs (final) / turn_events | ✅ turn_events=786 |
| 妈妈原话 | turn_events / parent_narrative_patterns | ✅ 786 + 18 |
| 孩子原话 | fact_atoms / evidence_episodes | ✅ fact_atoms 表存在 |
| 任务反馈 | user_tasks | ✅ 36 |

**结论**：映射表 layer_name 列与生产 schema **一致**，Trae 可将 SP 表头「待验证」改为「已验证 2026-07-18」。

---

## 静态形态校验（附录 A 可填充性）

基于四层采集 + daily turns + deep_mechanism 链，真实数据**足够支撑**附录 A 字段形态：

| dossier 段 | 现有数据源 | 生产库信号 |
|------------|------------|------------|
| familyStruct | entry packs + built + cycles | entry_evidence_packs 77, interaction_cycles 108 |
| fivePs | packs + daily_updates | daily_updates 1579, counter_evidence 34 |
| sceneReadings | episode + daily 场景 | turn_events 786 |
| parentPerspectives | parent_narrative_patterns | 18 |
| workingHypothesis | portraitSynthesizer LLM | 无直出表 |
| interventionTargets | user_tasks + hypotheses | user_tasks 36, pending_hypotheses 534 |

 richness 取决于 daily 轮次：Top 家庭 ≥270 daily_updates / ≥270 turn_events，满足「≥20 daily turns」门槛。

---

## 契约替代验证（本地无 PG 时）

- `npm run typecheck` + 远程 `npm run build`
- `npx tsx scripts/test-frontend-read-pack.mjs`
- `audit-deep-modeling-pipeline.mjs`：需在服务器 `cd /home/ubuntu/apps/yujian && export DATABASE_URL=…` 后跑

---

## 风险 / 下一步

- **PORTRAIT_V3=1 smoke（2026-07-18）**：`f_demo` job `deep_mechanism:portrait_smoke:20260718` succeeded ~90s；`dossier_v1` 已写入（version=1，workingHypothesis 84 字，integratedSynthesis 有人话预览）；`latest` schemaVersion=2、dossier.version=1。跑完已把 `PORTRAIT_V3` 从 `.env.local` 移除（恢复默认 off）。
- 脚本/Agent 凡 SSH psql：**固定 `cd /home/ubuntu/apps/yujian`**，勿用 `~/yujian`。
- 生产 audit 脚本可改为读 `process.env.DEPLOY_ROOT` 或文档化路径，避免再混 env。
