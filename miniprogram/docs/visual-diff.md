# 视觉差异登记表

对照基准：Web hi-fi（`app/hifi-app.css` / `hifi-build.css`），视口 **390px**。  
分级：**P0** 结构/路径 · **P1** 字号间距 · **P2** 装饰动画

## P0 — 结构 / 层级 / 路径（必须先过）

| 项目 | Web | 小程序 | 状态 |
|------|-----|--------|------|
| 单滚动 + 底栏占位 | page-stack 单滚；input-dock 在 Tab 上 | `HiFiMainShell` page--with-input/tab | 已对齐 |
| Tab 跳转 | 四 Tab 固定 | `switchTab` in navigation.ts | 已对齐 |
| Onboarding 底 CTA | bottom-actions 玻璃卡 grid | hifi-build fixed bottom-actions | parity-audit（build 三页） |
| input-dock 不被挡 | grid 行：内容 / input / tab | fixed dock @ tab-bar-height | 已对齐 |

## P1 — 字号 / 间距 / 圆角

| 项目 | Web | 小程序 | 原因 |
|------|-----|--------|------|
| 字重 display | 820 | 700 | 微信 Text 无 820 |
| 字体 | PingFang 系 | 微信系统字体 | 未加载 Web font-face |
| build hero compact | `.hero-card.compact` 更小内边距 | `build-hero-card.compact` | 已补 SCSS |
| Tab 图标 | SVG 描边 | data-uri SVG（对齐 Web path） | 已对齐 |

## P2 — 阴影 / 装饰 / 动画

| 项目 | Web | 小程序 | 原因 |
|------|-----|--------|------|
| 玻璃态 blur | `backdrop-filter: blur(22px)` | `rgba(255,255,255,0.92)` | 机型不支持 |
| 页面进场 | `page-entering` | 无 | 未移植 |
| 壳层 max-width | 430px 居中 phone shell | 全宽 | 微信全屏 |
| wave 录音动画 | CSS keyframes | 已移植 hifi-build | 已对齐 |
| hifi-mascot.png | — | ~96KB（330px 长边） | 已压缩 |
| 预演 checkpoint | 每 4 轮 modal | 简化为结束预演 | 交互待细化 |

## 已对齐（感知级）

- 全局奶油绿渐变背景
- 绿色渐变家长气泡 / 白色 AI 气泡（72% / 86% 宽比）
- 自定义玻璃态底部 Tab（`tabBar.custom`）
- Onboarding：BuildRecordBox、FollowUpCard、record-box 结构
- Daily hero + starter pills + thinking 四宫格
- HiFiInputZone hold-button 52px 绿渐变

## 待下一轮（可选 P2）

- intro/basic/hub 390px 像素微调
- 页面进场 `page-entering` 动画（非阻断）
- 玻璃态 `backdrop-filter`（机型差异，保持 fallback）

## 已收口（2026-07-09）

- Profile 卡片详情已套 `HiFiMainShell`
- DailyDeepExpandCard + AuthorityInsightCard 段
- summary AuthorityInsightCard / StructuralTensionCard
- Tab SVG 图标 + mascot 压缩

## Round3 静态审计（2026-07-08）

脚本：`npm run style-parity-audit` → [style-parity-report.md](./style-parity-report.md)

| 结果 | 说明 |
|------|------|
| Token 4/4 | 品牌色、按钮高、input-dock、气泡宽比 |
| Class 7/7 | page 占位、input-dock、hold-button、record-box、Tab、profile 卡、checkpoint |
| P2 登记 | 字重 820、玻璃 blur（机型差异） |


四 Tab + build 三页 **P0 结构 class 已通过静态审计**；P1 字体/图标仍见上表 P1 节。
