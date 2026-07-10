# 模块 M5：画像 Tab

**状态**：P0/P1 已修复（2026-07-08）

## 范围

| Web | 小程序 |
|-----|--------|
| `/family-profile` | `pages/profile/index` |
| `/family-profile/[card]` | `pages/profile/card?id=` |
| `/profile/result`（Tab 入口） | `packageOnboarding/pages/result`（navigateTo） |

## 审计发现（修复前）

| 维度 | 差距 |
|------|------|
| 数据状态 | 期望 `hub.cards[]`，API 实际返回扁平字段 → Tab 永远空 |
| 数据状态 | 未 hydrate `/api/profile/built`、未读 snapshot/weekly |
| 用户流程 | 无「查看完整画像」「沟通预演」入口 |
| 交互 | 无 loading / 错误 / 刷新；无 daily-refresh 后台更新 |
| UI | 标题「孩子画像」vs Web「画像数据中心」；卡片详情无返回/空态 |

## 已修复

| ID | 问题 | 文件 | 说明 |
|----|------|------|------|
| M5-01 | hub 卡片永远为空 | `lib/portraitCard.ts`, `pages/profile/index.tsx` | 客户端组装 7 张卡，对齐 Web |
| M5-02 | 未读 built 本地缓存 | `services/profileStorage.ts`, `index.tsx` | GET built → hydrate |
| M5-03 | 缺 snapshot / weekly | `index.tsx` | 最近变化区块 |
| M5-04 | 无 daily-refresh | `index.tsx` | Tab 首次展示后台刷新 + 更新提示 |
| M5-05 | 无 loading / 错误 / 刷新 | `index.tsx`, `index.scss` | hubLoading + 刷新画像 |
| M5-06 | 卡片详情残缺 | `pages/profile/card/index.tsx` | loading/空态/返回/sections/facts/tensions |
| M5-07 | 无 Tab 操作入口 | `index.tsx`, `navigation.ts` | 完整画像 + 预演 Tab |
| M5-08 | 90s Tab 缓存 | `lib/profileTabCache.ts` | 对齐 Web profile-tab-cache |

## 仍登记 P2

- `/profile/deep` 机制链独立页（Web 有，小程序暂无）
- 修改密码 / 注销账号（ProfileEditModals）
- PortraitCardDetail 像素级 parity-audit
- password/delete 账号管理项

## 回归

- [ ] onboarding 完成 → 画像 Tab 显示 ≥1 张摘要卡
- [ ] 点卡片 → 详情有内容或空态提示 → 返回 Tab
- [ ] 「查看完整画像」→ result 页加载
- [ ] 「沟通预演」→ 预演 Tab
- [x] typecheck + build:weapp
