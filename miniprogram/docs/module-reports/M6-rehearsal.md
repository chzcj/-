# 模块 M6：沟通预演

**状态**：P0/P1 已修复（2026-07-08）

## 范围

| Web | 小程序 |
|-----|--------|
| `/rehearsal` | `pages/rehearsal/index` |

## 审计发现（修复前）

| 维度 | 差距 |
|------|------|
| 数据状态 | `parentText` 未嵌入场景；无 `parentRoundCount` |
| 用户流程 | 无 confirm 画像要点；无 4 轮 checkpoint；结束页静态文案 |
| 交互 | 无 NDJSON 流式；错误仅 toast；无 thinking 态 |
| 数据联动 | daily `rehearsal` action 未跳转预演；无任务保存 |

## 已修复

| ID | 问题 | 文件 | 说明 |
|----|------|------|------|
| M6-01 | API 请求体不对齐 | `rehearsalAnalyze.ts`, `rehearsal/index.tsx` | 场景写入 parentText + parentRoundCount |
| M6-02 | 无 NDJSON 流式 | `rehearsalAnalyze.ts`, `lib/rehearsalStream.ts` | reaction_delta + final |
| M6-03 | 错误仅 toast | `rehearsal/index.tsx` | 气泡内中断提示 |
| M6-04 | 无 thinking 指示 | `SimulationBubbles.tsx`, `index.tsx` | thinking bubble |
| M6-05 | confirm 缺画像要点 | `rehearsal/index.tsx` | `getLatestProfile()` bullets |
| M6-06 | 无 checkpoint 弹窗 | `rehearsal/index.tsx` | 每 4 轮继续/结束 |
| M6-07 | 结束页无 API 总结 | `rehearsal/index.tsx` | closingAdvice / saferVersion 等 |
| M6-08 | 无任务保存 | `taskStorage.ts` | POST /api/tasks |
| M6-09 | daily rehearsal action | `DailyAiMessage.tsx` | scene seed + switchTab |
| M6-10 | 孩子名标签缺失 | `SimulationBubbles.tsx` | `{name} SecondMe` |
| M6-11 | 入口场景 UI 简化 | `rehearsal/index.tsx` | 场景卡片 + 自定义场景 |

## 仍登记 P2

- `RehearsalDialogueCapture`（深度解读 / ASR 粘贴）
- AuthorityInsightCard 像素级 parity
- scenario-grid 与 Web hifi CSS 精修

## 回归

- [ ] 选场景 → confirm → 进入预演 → 发 1 轮 → 孩子 SecondMe 流式/完整回复
- [ ] 连发 4 轮 → checkpoint 弹窗 → 结束 → 总结 + 保存任务
- [ ] daily 交流点「预演」action → 预演 Tab 场景预选
- [x] typecheck + build:weapp
