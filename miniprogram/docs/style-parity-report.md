# Style Parity Report

生成时间：2026-07-10 08:34:17 (UTC)

基准：Web `app/hifi-app.css` / `hifi-build.css`，视口 390px。本报告为**静态 class/token 审计**，真机感知仍需人工对照。

## 摘要

- Token 检查：4/4 通过
- 组件 class 检查：8/8 通过
- P0 未通过：0
- P1 未通过：0

## Token 对照

| ID | 级别 | 项 | 文件 | 结果 |
|----|------|-----|------|------|
| T-green-deep | P1 | 品牌绿 $green-deep | `src/styles/tokens.scss` | pass |
| T-btn-primary | P1 | 主按钮高度 52px | `src/styles/tokens.scss` | pass |
| T-input-dock | P0 | 输入区占位高度 | `src/styles/tokens.scss` | pass |
| T-bubble-ratio | P1 | 气泡宽度比例 | `src/styles/tokens.scss` | pass |

## 组件 Class 对照

| ID | 级别 | 项 | 文件 | 结果 |
|----|------|-----|------|------|
| C-hold-button | P0 | 交流按住说话 | `src/components/hifi/HiFiInputZone/index.scss` | pass |
| C-record-box | P0 | Onboarding record-box | `src/styles/hifi-build.scss` | pass |
| C-page-shell | P0 | 单滚动壳层占位 | `src/styles/hifi-base.scss` | pass |
| C-input-dock | P0 | 交流输入区 fixed dock | `src/components/hifi/HiFiMainShell/index.scss` | pass |
| C-tab-bar | P1 | 自定义 TabBar | `src/custom-tab-bar/index.scss` | pass |
| C-profile-card | P1 | 画像 Tab 数据卡 | `src/pages/profile/index.scss` | pass |
| C-checkpoint | P2 | 预演 checkpoint | `src/pages/rehearsal/index.scss` | pass |
| C-motion | P1 | 动效库 page-rise / section-reveal | `src/styles/motion.scss` | pass |

## 登记 P2（不阻断）

| ID | 项 | 说明 |
|----|-----|------|
| P2-font-weight | 字重 820→700 | 微信 Text 无 820，见 visual-diff P1 |
| P2-glass-blur | 玻璃态 blur | backdrop-filter 机型差异 |
| P2-mascot-size | hifi-mascot.png 体积 | 已压缩至 <120KB |
| P2-tab-svg | Tab SVG 图标 | data-uri SVG 对齐 Web path |

## 待修复项

无 P0/P1 静态项失败。

## 建议人工验收页面

1. `/daily` — hold-button、气泡 72%/86%、thinking 四宫格
2. `capture` — record-box 184px 感知高度、wave 动画
3. `/profile` — 画像数据中心卡片与进度条
4. `/rehearsal` — scenario-grid、checkpoint 弹层
5. 真机 ASR — 按住说话 + socket 白名单
