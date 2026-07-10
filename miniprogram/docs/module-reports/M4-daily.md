# 模块 M4：日常 AI 交流

**状态**：P0/P1 已修复（2026-07-08）

## 范围

| Web | 小程序 |
|-----|--------|
| `/daily` | `pages/daily` |

## 审计发现（修复前）

| 维度 | 差距 |
|------|------|
| 数据状态 | 未传 `recentSectionIds`；未 POST `daily-refresh`；未从服务端 hydrate 线程 |
| 用户流程 | 流式中再发消息只排队，Web 会中断当前流；无 `section-retry` |
| 交互 | HTTP/流错误仅 toast，气泡无文案；无 `interrupted` 提示；无 memory-status 轮询 |
| UI | thinkingChips 固定占位，未读 hub 种子 |

## 已修复

| ID | 问题 | 文件 | 说明 |
|----|------|------|------|
| M4-01 | 未传 recentSectionIds | `dailyThreadUtils.ts`, `daily/index.tsx`, `dailyStream.ts` | 对齐 Web BFF 去重 |
| M4-02 | 启动未 daily-refresh + hydrate | `daily/index.tsx` | 本地优先，服务端覆盖 |
| M4-03 | thinkingChips 未读 hub | `daily/index.tsx` | GET `/api/profile/hub` |
| M4-04 | 流式中提交只排队 | `daily/index.tsx` | interrupt + 立即新 turn |
| M4-05 | 错误仅 toast | `daily/index.tsx` | 气泡内错误文案 |
| M4-06 | 无 section-retry | `daily/index.tsx` | POST `/api/daily/section-retry` |
| M4-07 | 无 memory 状态 | `daily/index.tsx` | GET `/api/daily/memory-status` 2s 后轮询 |
| M4-08 | 无 interrupted 态 | `DailyAiMessage.tsx`, `dailyStream.ts` | abortRef + taskRef |
| M4-09 | prose/section 完成态缺失 | `daily/index.tsx`, `DailyAiMessage.tsx` | `proseComplete` / `sectionsComplete` / `sectionErrors` |

## 仍登记 P2

- 深度展开卡视觉与 Web `DailyDeepExpandCard` 像素级对照（parity-audit）
- 气泡字号/间距 Round3 脚本项
- 队列模式下 chip 点击行为（Web 同等）

## 回归

- [ ] onboarding 完成 → daily Tab → 发一条 → thinking → prose → section → actions
- [ ] 流式中再发 → 中断提示 + 新回复
- [ ] section 失败 → 重试按钮可用
- [ ] 杀进程重进 → 本地线程仍在；有远端时 hydrate
- [x] typecheck + build:weapp
