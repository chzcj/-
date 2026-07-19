# Portrait Real Data Validation (Task 0)

> 本地文档，不入库 Git。PII 保护：不记录原始家长/孩子文本。

## 执行摘要

| 项 | 状态 | 说明 |
|----|------|------|
| SubTask 0.1 DATABASE_URL | **阻塞** | 本机 `.env.local` 指向 `127.0.0.1:5432` → `ECONNREFUSED`（本地 PG 未运行）。历史记录：生产库 password authentication failed（疑密码轮换，见 spec 附录 D）。 |
| SubTask 0.2 只读 SQL 聚合 | **未执行** | 依赖 DBA 提供可用 `DATABASE_URL`（生产只读或 staging）。 |
| SubTask 0.3 形态校验 | **部分** | 基于 spec 附录 A/C 样例 + 现有 memory 层契约做静态对齐；待真实库验证 rich 度。 |

## 连接尝试（2026-07-18）

```
本机 DATABASE_URL → 127.0.0.1:5432 → ECONNREFUSED（本地 PG 未运行）

SSH ubuntu@81.70.228.8（2026-07-18 二次）：
  DATABASE_URL=postgresql://childos:***@127.0.0.1 / db=childos_mvp
  psql -U childos → FATAL: password authentication failed for user "childos"
  （即使用 .env.local 明文密码直连仍失败 → PG 侧密码与 .env 不同步，非 sed 解析问题）

counter_evidence SQL：未执行（同上阻塞）
```

**8 标签 layer_name 映射表**：待 SubTask 0.2 拉到 `memory_layer_items` 按 layer_name 分布后，对照 `portraitSynthesizer.md` L55-74 映射表逐列核对是否真实存在。

**下一步（DBA）**

1. 核对 `~/yujian/.env.local` 或部署机 `DATABASE_URL` 与 PG 实际密码。
2. 提供只读连接后执行下列聚合（不含 raw text）：

```sql
-- 最丰富家庭（示意）
SELECT family_id, child_id, layer_name, count(*) AS n
FROM memory_layer_items
GROUP BY 1, 2, 3
ORDER BY n DESC
LIMIT 50;

-- 场景/证据类型分布（episode atoms 元数据落地后）
SELECT source_type, fact_type, count(*)
FROM fact_atoms
GROUP BY 1, 2;
```

## 静态形态校验（附录 A 可填充性）

基于现有四层采集 + daily turns + deep_mechanism 链，**理论上**可支撑：

| dossier 段 | 现有数据源 | 备注 |
|------------|------------|------|
| familyStruct | entry packs + built snapshot + cycles | 需 portraitSynthesizer 整合，非单表直出 |
| fivePs | 同上 + daily_updates | perpetuating/protective 需跨场景计数（v3 confidence） |
| sceneReadings | episode sceneTags + daily 场景 | episode 元数据 evidenceTier 提升质量（PR-C6） |
| parentPerspectives | parent_narrative_patterns + packs | 已有写路径 |
| workingHypothesis | 无直出 | 必须 LLM 整合（portraitSynthesizer） |
| interventionTargets | user_tasks + hypotheses | 任务 feedback 驱动 L2 |

**结论**：真实数据**足够支撑**附录 A 字段形态，但 richness 取决于 daily 轮次与四模块完成度；Task 0 SQL 仅用于确认「最丰富家庭」是否 ≥20 daily turns + 四模块齐。

## 契约替代验证（DB 不可用时）

- `npm run typecheck` + `npm run build`
- `node scripts/test-frontend-read-pack.mjs`
- `node scripts/audit-memory-contract.mjs`
- mock dossier → `dossier-slicer` 单元路径（见 PR-E）

## 风险

- 在无真实库前，portraitSynthesizer 输出深度仅能用附录 A 样例人工验收。
- 生产密码恢复后应重跑 SubTask 0.2 并更新本节「执行摘要」表。
