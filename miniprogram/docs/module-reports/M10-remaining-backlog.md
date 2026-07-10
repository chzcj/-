# M10 — 剩余 Backlog 全量收口

**范围**：M2-07~11、M4-05、M5-05/06、M6-05、M7-05、M8-01  
**日期**：2026-07-09

## 修复摘要

| ID | 问题 | 修复 | 文件 |
|----|------|------|------|
| M2-07 | follow-up 提交失败静默跳 summary | API 失败设 `apiError`，内联「直接整理」+ 重试 | `follow-up/index.tsx` |
| M2-08 | capture 失败仅 toast | `apiError` + `soft-card` 内联错误 | `capture/index.tsx` |
| M2-10 | summary 无权威卡/张力卡 | 移植 `AuthorityInsightCard` + `StructuralTensionCard`；拉 hub | `summary/index.tsx`, `components/hifi/*` |
| M2-11 | hub 已完成模块无警告 | `Taro.showModal` 重填提示 | `hub/index.tsx` |
| M4-05 | 深度展开无权威段落样式 | `DailySectionView` 对齐 Web（authority 段 + 流式解析） | `DailySectionView.tsx`, `parseStreamingSection.ts`, `hifi-base.scss` |
| M5-05 | 缺机制链页 | 新增 `pages/profile/deep` + 画像 Tab 入口 | `profile/deep/*`, `profile/index.tsx` |
| M5-06 | 缺改密/注销 | `ProfileEditModals` 扩展 password/delete | `ProfileEditModals.tsx` |
| M6-05 | 缺对话深度解读 | `RehearsalDialogueCapture` + dialogue-analyze | `components/rehearsal/*`, `rehearsal/index.tsx` |
| M7-05 | 缺 how_to_speak 页 | `pages/daily/how-to-speak` + `DailyAiMessage` action | `how-to-speak/*`, `DailyAiMessage.tsx` |
| M8-01 | account/state 仅 child+thread | `assembleChildOSV1` / `hydrateFromChildOSV1` 全量 round-trip | `childosV1Storage.ts`, `accountSync.ts` |

## M8 数据流

```
forceAccountSyncToServer
  → assembleChildOSV1()  // buildState + profile + child → childos.v1
  → POST /api/account/state

restoreAccountStateFromServer (登录后)
  → GET /api/account/state
  → hydrateFromChildOSV1(storage)  // 回灌 buildState / profile / child
  → saveDailyThread
```

## 新增页面（app.config）

- `pages/daily/how-to-speak/index`
- `pages/profile/deep/index`

## 构建

```bash
npm run typecheck && npm run style-parity-audit && npm run build:weapp
```

全部通过（CSS order 警告可忽略；mascot 737KB 仍登记 P2）。

## 仍 open

| ID | 说明 |
|----|------|
| M9-01 | 真机 ASR：socket 白名单 + TENCENT_* + scope.record（运维） |

## 回归 smoke

1. capture 断网提交 → 内联错误卡  
2. follow-up 提交失败 → 「直接整理」可用  
3. hub 点已完成模块 → 确认弹窗  
4. summary → AuthorityInsightCard + 张力卡（有 hub 数据时）  
5. daily「怎么开口」action → how-to-speak 页  
6. 预演页底部 → 对话深度解读  
7. 画像 → 机制链解释 / 改密 / 注销  
8. 换号登录 → buildState + profile 从 account/state 恢复
