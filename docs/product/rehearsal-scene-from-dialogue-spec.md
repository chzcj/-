# 预演场景：从日常对话生成 Top5 场景卡（设计规格）

> **本轮范围**：设计文档 + SP 草案。**不注册** `rehearsalSceneRanker` 到 registry；**不建 UI**（等待 hi-fi mock）。

## 产品目标

家长进入「预演」Tab 时，看到 **Top5 高频冲突/卡点场景**，每张卡：

- **上栏**：该场景的扩展说明（为什么常出现、典型升级点）
- **下栏**：**child slice** —— 不是泛化「写作业」，而是「催作业时的启动阻力」这类具体切片

场景来源应 grounded 于家庭真实对话与画像，不是通用育儿题库。

## 输入字段（BFF 读包）

| 字段 | 来源 | 用途 |
|------|------|------|
| `entryFacts` | 四模块采集 | 锚定具体家庭事实 |
| `sceneReadings` | dossier v3 | 场景交织叙述 |
| `familyPatterns` | 深度 digest / hub | 亲子循环模式 |
| `turn_events` 高频词 | 近 90 天 turn，分词/关键词 | 作业/手机/催促/睡觉… |
| `growthTrajectory` | 轨迹难题 | 长期反复主题 |
| `rehearsal_history` | 预演 turn 模式=rehearsal | 已练过的场景降权 |

## Top5 算法（代码化，非 LLM 排序）

```
score(scene) =
  freq(keywords, last90d) * 1.0
  + freq(keywords, last14d) * 2.0   // 近两周加权
  + trajectory_match * 1.5
  - rehearsed_in_last7d * 2.0       // 刚练过降权
  - duplicate_cluster_penalty       // 语义近邻去重
```

1. 从 turn_events.userMessage 提取候选词（规则 + 小词典：作业/手机/游戏/睡觉/催促/顶嘴/成绩…）
2. 聚类为 **scene cluster**（如「作业-启动」「作业-加任务」「手机-时长」）
3. 取 score Top5；不足 5 时用 entryFacts 补位
4. **刷新按钮**：重新跑 rank（同一 tenant，新 requestId）

## 场景卡 JSON（UI 契约草案）

```typescript
type RehearsalSceneCard = {
  sceneId: string           // 稳定 id，如 scene:homework_start
  rank: number              // 1-5
  title: string             // ≤16 字，如「催作业时的启动阻力」
  sceneExpansion: string    // 上栏 80-120 字
  childSlice: string        // 下栏 60-100 字，针对这个孩子
  evidenceRefs: string[]    // 内部追溯，不进 UI
  refreshedAt: string
}
```

## Agent 草案：`rehearsalSceneRanker`（仅 spec）

**角色**：读 Top5 cluster + 家庭读包，为每条 cluster 写 `sceneExpansion` + `childSlice`。

**硬规则**：

- 必须引用至少 1 条 entryFact 或 sceneReading
- 禁止理论名、诊断标签
- childSlice 必须含「这个孩子」的具体行为/原话倾向，不能泛化「写作业」

**输出**：`{ scenes: RehearsalSceneCard[] }`（恰好 5 或不足 honestly 返回）

## 与手账准入的衔接

| 预演行为 | 手账 |
|----------|------|
| 完成一次预演语音 turn | `rehearsal_voice` 准入 |
| 场景卡仅浏览未练 | 不进手账 |

## 任务页衔接（1 页说明）

**tonightTaskGenerator** 产出任务 → 家长反馈 shine → `task_shine` 准入手账。

设计要点：

1. 任务 feedback 表单 positive regex 与 handook-admission 共用
2. 任务 title 作为 `titleHint` 传入 handbookLineEditor
3. 任务页 UI 本轮不改；仅保证 feedback 写入 `user_tasks.feedback`

## 后续 Phase（等 hi-fi）

1. `GET /api/rehearsal/scene-pack` BFF
2. MP/Web 预演页 1:1 mock
3. 注册 `rehearsalSceneRanker` + job `rehearsal_scene_refresh`
4. 与 communication_rehearsal 现有语音链路对接（**语音文件仍走锁定链路**）

## 验收标准（实现时）

- [ ] Top5 随 turn 更新而变，非静态题库
- [ ] 刷新可观测（refreshedAt + rank 变化）
- [ ] 每条 childSlice 含家庭特异性
- [ ] 预演 voice turn 准入手账，纯浏览不准入
