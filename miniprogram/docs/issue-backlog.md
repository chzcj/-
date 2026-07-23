# 迁移问题清单

状态：`open` | `fixed` | `verified`

## P0 阻断

| ID | 模块 | 问题 | 状态 | 涉及文件 |
|----|------|------|------|----------|
| M2-01 | 首次建模 | summary AI 失败无按钮、页面卡死 | fixed | `summary/index.tsx` |
| M2-02 | 首次建模 | summary 不读本地 stageSummary 缓存 | fixed | `entryStorage.ts`, `summary/index.tsx` |
| M2-03 | 首次建模 | 模块「已完成」在用户确认前就标记 | fixed | `entryStorage.ts`, `buildState.ts` |
| M2-04 | 首次建模 | 修改采集/追问文本后仍显示旧 summary | fixed | `entryStorage.ts` |
| M2-05 | 首次建模 | intro/basic/final-follow-up navigateTo 堆栈 | fixed | `intro`, `basic`, `final-follow-up` |
| M2-06 | 首次建模 | final-follow-up API 失败无提示、仍跳转 | fixed | `final-follow-up/index.tsx` |

## P1 核心体验

| ID | 模块 | 问题 | 状态 |
|----|------|------|------|
| M2-07 | 首次建模 | follow-up API 失败时仅靠 skip，无内联「直接整理」 | fixed | `follow-up/index.tsx` |
| M2-08 | 首次建模 | capture 提交失败无内联错误卡（仅 toast） | fixed | `capture/index.tsx` |
| M2-09 | 首次建模 | summary 缺 confirm 软卡 | fixed | `summary/index.tsx` |
| M1-01 | 身份 | 微信登录未 forceSync/清本地 | fixed | `postAuthRoute.ts`, `auth.ts` |
| M9-01 | ASR | 真机语音不可用（socket 白名单 + 服务端 TENCENT_* + scope.record） | open — 验收 [M9-DEVICE-QA.md](./M9-DEVICE-QA.md) |
| M3-01 | 画像生成 | generating 无门禁 | fixed | `generating/index.tsx` |
| M3-02 | 画像生成 | 未轮询 deep-model-status | fixed | `profilePipeline.ts` |
| M3-03 | 画像生成 | result 无 loading/空态 | fixed | `result/index.tsx` |
| M4-01 | 日常交流 | 未传 recentSectionIds | fixed | `dailyThreadUtils.ts`, `daily/index.tsx` |
| M4-02 | 日常交流 | 未 daily-refresh / hydrate 线程 | fixed | `daily/index.tsx` |
| M4-03 | 日常交流 | 流式错误仅 toast、无中断态 | fixed | `daily/index.tsx`, `DailyAiMessage.tsx` |
| M4-04 | 日常交流 | 无 section-retry / memory-status | fixed | `daily/index.tsx` |
| M5-01 | 画像 Tab | hub 期望 cards[] 导致永远空 | fixed | `portraitCard.ts`, `profile/index.tsx` |
| M5-02 | 画像 Tab | 未 hydrate built / snapshot / weekly | fixed | `profileStorage.ts`, `profile/index.tsx` |
| M5-03 | 画像 Tab | 无 loading/错误/daily-refresh | fixed | `profile/index.tsx` |
| M5-04 | 画像 Tab | 卡片详情无返回/空态/tensions | fixed | `profile/card/index.tsx` |
| M6-01 | 预演 | API 请求体未嵌入场景/parentRoundCount | fixed | `rehearsalAnalyze.ts` |
| M6-02 | 预演 | 无 NDJSON 流式与 thinking | fixed | `rehearsalAnalyze.ts`, `SimulationBubbles.tsx` |
| M6-03 | 预演 | 错误仅 toast、无 checkpoint/结束总结 | fixed | `rehearsal/index.tsx` |
| M6-04 | 预演 | 无任务保存、daily rehearsal action | fixed | `taskStorage.ts`, `DailyAiMessage.tsx` |
| M7-01 | 任务 | taskId 未映射 id | fixed | `taskStorage.ts` |
| M7-02 | 任务 | 反馈 PUT 应为 POST | fixed | `taskStorage.ts` |
| M7-03 | 任务 | 无 loading/来源/乐观更新 | fixed | `pages/tasks/index.tsx` |
| M7-04 | 任务 | daily task action 缺失 | fixed | `DailyAiMessage.tsx` |
| M7-06 | 任务 | chip 用 catchClick 导致真机零响应 | fixed | `TaskFeedbackPanel.tsx` — 改 Text+onClick |
| M7-07 | 任务 | max-height 展开吞触摸 | fixed | `pages/tasks/index.tsx` — 条件 mount |
| M7-08 | 任务 | 补充区无提交按钮 / chevron 无文案 | fixed | `TaskFeedbackPanel` + `index.scss` |
| M7-09 | 任务 | 系统文案硬编码「孩子」 | fixed | `child-system-copy.ts` |
| M7-10 | 任务 | 卡片点击蓝闪/缩放 | fixed | `pages/tasks/index.tsx` hoverClass/tap-highlight |
| M7-11 | 任务 | refine/merge 导致内容薄或重复卡 | fixed | `task-service.ts`, `taskStorage.ts` |

## P2 细节

| ID | 模块 | 问题 | 状态 |
|----|------|------|------|
| M2-10 | 首次建模 | summary 缺 AuthorityInsightCard / StructuralTensionCard | fixed | `summary/index.tsx`, `AuthorityInsightCard` |
| M2-11 | 首次建模 | hub 点击已完成模块应提示重填会清空整理 | fixed | `hub/index.tsx` |
| M4-05 | 日常交流 | 深度展开卡 / 气泡视觉 parity-audit | fixed | `DailySectionView.tsx` |
| M5-05 | 画像 Tab | /profile/deep 机制链页缺失 | fixed | `pages/profile/deep` |
| M5-06 | 画像 Tab | 修改密码 / 注销账号 | fixed | `ProfileEditModals.tsx` |
| M6-05 | 预演 | RehearsalDialogueCapture 深度解读 | fixed | `RehearsalDialogueCapture.tsx` |
| M7-05 | 任务 | how_to_speak 独立页缺失 | fixed | `pages/daily/how-to-speak` |
| M8-01 | 数据同步 | account/state 全量 childos.v1 还原 | fixed | `childosV1Storage.ts`, `accountSync.ts` |

## 推荐修复顺序

1. ~~M2–M7 四 Tab 主流程~~（已完成）
2. ~~M1 身份 + M8 数据同步~~（已完成）
3. ~~M9 ASR + Round3 视觉~~（客户端已完成）
4. ~~剩余 P1/P2 backlog（M2-07~11、M4-05、M5-05/06、M6-05、M7-05、M8-01）~~（已完成）
5. **仅剩 M9-01 真机 ASR E2E**（运维 + 真机验收）
