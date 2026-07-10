# 模块 M7：任务 Tab

**状态**：P0/P1 已修复（2026-07-08）

## 范围

| Web | 小程序 |
|-----|--------|
| `/tasks` | `pages/tasks/index` |
| daily/rehearsal 创建任务 | `DailyAiMessage` + `taskStorage` |

## 审计发现（修复前）

| 维度 | 差距 |
|------|------|
| 数据状态 | API 返回 `taskId`，页面用 `id` → 列表 key/反馈失效 |
| 数据状态 | 反馈用 `PUT`，服务端仅 `POST` |
| 用户流程 | Web 无手动添加；MP 多出手动表单（偏离） |
| 交互 | 无 loading / saving；无 `task.source` |
| 联动 | daily `task` action 未实现 |

## 已修复

| ID | 问题 | 文件 | 说明 |
|----|------|------|------|
| M7-01 | taskId 未映射 | `taskStorage.ts` | `mapServerTask` taskId→id |
| M7-02 | 反馈 PUT 错误 | `taskStorage.ts` | POST `/api/tasks/[id]/feedback` |
| M7-03 | 无本地缓存回退 | `taskStorage.ts` | `childos.v2.tasks` 对齐 Web |
| M7-04 | 页面偏离 Web | `pages/tasks/index.tsx` | 移除手动添加；loading/空态/来源/状态 |
| M7-05 | 反馈无 optimistic | `index.tsx` | savingId + 乐观更新 |
| M7-06 | 备注无 debounce | `TaskFeedbackPanel.tsx` | 400ms + blur flush |
| M7-07 | daily task action | `DailyAiMessage.tsx` | pickTaskTitle + saveTask |
| M7-08 | taskStatus 推导 | `index.tsx` | 对齐 Web `taskStatus()` |

## 仍登记 P2

- status-tag 像素级 parity（caret / hifi CSS）
- `how_to_speak` navigate action（Web 有独立页，MP 无）

## 回归

- [ ] 预演结束「今晚试一次」→ 任务 Tab 可见 + 来源「沟通预演」
- [ ] daily「保存为今晚任务」→ 按钮变「已保存到任务」
- [ ] 展开任务 → 选反馈 → 状态更新（POST 成功）
- [x] typecheck + build:weapp
