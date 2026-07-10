# Build 页视觉审计（Web → 小程序）

对照基准：Web `app/profile/build/hifi-build.css` + `EntryCapturePage` / `EntryFollowUpPage` / `EntrySummaryPage`，视口 390px。

## 已修复项（本次）

| 问题 | Web 参考 | 小程序修复 |
|------|----------|------------|
| 标题重复（prompt = title） | Hero kicker 用 stepLabel，title 单独 | capture `kicker={stepLabel 专项采集}`，prompt 进 record-box light-prompt |
| 语音按钮挤在底部 | 输入区 hold + 底部主 CTA | `BuildRecordBox` 内 hold-chip，底部仅提交/跳过 |
| 追问页 140 字上限 | 无默认限制 | `maxlength=4000` + `n/4000` 计数 |
| 追问页缺 FollowUpCard | `FollowUpCard.tsx` | 移植 `components/profile/FollowUpCard.tsx` |
| record-box 简陋白盒 | record-head/status/area/meta/wave | `hifi-build.scss` 整段移植 |
| bottom-actions 全宽渐变条 | 玻璃卡片 grid | 固定底栏 + `dense` 多按钮布局 |
| summary 信息不足像卡死 | 多 CTA | `insufficient-banner` + 返回补充 / 先继续下一模块 |
| ASR onOpen/close 崩溃 | N/A | `useTencentAsrInput` SocketTask 守卫 + safeClose |

## 仍可对齐的细项（非阻塞）

- Hero `compact` 模式字号略小（Web 有 mascot 位，小程序暂无）
- capture 页 Web 有 `page-entering` 入场动画（小程序未加，避免首屏闪烁）
- summary 页 Web 有 `AuthorityInsightCard` / `StructuralTensionCard`（需额外 API，P2）

## 验收清单

- [x] capture / follow-up：底部仅主按钮 + quiet 跳过，语音在输入区内
- [x] follow-up：可输入 4000 字，显示字数
- [ ] 开发者工具勾选不校验域名后：按住说话有实时文字并写回输入框（需本地 socket 白名单）
- [x] family 4/4：追问 → summary（信息不足 banner）→ 可继续下一模块
