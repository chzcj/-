# 预演 / 任务 · 字段库存与消费契约（调研卷 · 不重建 UI）

> 2026-07-20 | Phase4 产出 | **本阶段不改预演/任务页面像素**  
> 关联：[`rehearsal-scene-from-dialogue-spec.md`](./rehearsal-scene-from-dialogue-spec.md)、`scripts/diag-rehearsal-pain-points.mjs`

## 1. 已拍板

- 预演场景 **1–5 必须从对话动态长出**（禁止静态 3 seed 冒充）
- `mentionCountHint`：**代码统计** turn_events，LLM 只润色 title/lede
- Brief 上栏 = 场景扩展；下栏 = **该痛点切片下**对孩子的理解（非全局糊话）
- 任务反馈进手账：`effect`/`completed` ≥8 字（已有 quality-gate）

## 2. 服务器字段：有效 vs 无效

| 字段 | 层 | 对 Top5 痛点 | 对 Brief 下栏 | 判定 |
|------|----|--------------|---------------|------|
| `turn_events.userMessage` | L0 | **最高** 频次真源 | 场景原话 | **有效 · 主源** |
| `index-tag-engine` sceneTags | 规则 | 作业/手机/顶嘴… | — | **有效 · 代码计频** |
| `entryFacts` / triggerPoints | entry | 补位 | 锚定 | **有效** |
| `dossier.sceneReadings[]` | dossier | 聚类描述 | **child slice 主源** | **有效 · Brief 下栏优先** |
| `deepModelDigest.childQuotes` | digest | 证据 | 下栏引用 | **有效** |
| `growthTrajectory.entries` | trajectory | 长期加权 | — | **有效 · 加分** |
| `fact_atoms` high-value | atoms | 次 | 摘句 | **有效** |
| `REHEARSAL_SCENES` 静态 3 条 | 前端 | 仅 fallback | — | **无效作主展示** |
| LLM 编造的「提过 N 次」 | hydrator | — | — | **无效 · 禁止** |
| 截断 200 字的 history | 旧读包 | 糊 | 糊 | **已弃用读路径**（改 verbatim 20） |

## 3. Top5 消费方案（已落地后端）

```
listTurnEvents(400)
  → rankPainClusters（n14*2+n90；滤预演套话）
  → Top5 cluster → seed + sampleQuotes
  → hydrator 只润色 title/lede/summary
  → mentionCountHint = 代码 hintFor(n14,n90)
```

实现：`src/lib/server/rehearsal/scene-pain-ranker.ts` + `GET /api/rehearsal/scenes`  
前端：按 API 列表渲染（可到 5 条），不再锁死静态 3。

Fallback：无信号时静态最多 3 条，**不写假频次**。

### 生产摸底（2026-07-20 · fam_1783439265597_luqfco）

| cluster | 近90天 | 近14天 | 样例 |
|---------|--------|--------|------|
| homework_start | 18 | 18 | 感觉跟孩子最近老吵架…写作业 |
| after_conflict | 5 | 5 | （含预演套话噪声，ranker 已滤【预演场景】） |
| phone | 3 | 3 | 手机规则相关 |
| morning / grades | 0 | 0 | 用 seed 补位、无假频次 |

## 4. Brief 两栏字段

| UI | API | 读包 |
|----|-----|------|
| 情景长什么样 | `sceneSituation` | 该 cluster 样例 turns + entryFacts |
| 记忆里对孩子的理解 | `childUnderstanding` 或 `bullets[3]` | `sceneReadings` 匹配 scene + childQuotes |
| 开场一句 | `openingHint` | 可选 |

## 5. 任务页（证据规则 · 不改 UI）

| 写入 | 消费者 |
|------|--------|
| `task.feedback.effect` / `completed` | handbook `task_shine` rawEvidence |
| 仅「好」「完成了」 | quality-gate **拒** |
| ≥8 字实质反馈 | 准入 + 详情 02 |

## 6. 摸底命令

```bash
DATABASE_URL=... npx tsx scripts/diag-rehearsal-pain-points.mjs <familyId> <childId>
```

## 7. 本续卷边界

- ✅ 已接 Top5 排序 API + mentionCountHint 代码化
- ❌ 仍不重做预演像素高保真（等新 mock）
- ❌ 不改任务页 UI
