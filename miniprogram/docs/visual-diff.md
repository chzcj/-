# 视觉差异登记表

对照基准：Web hi-fi（`app/hifi-app.css` / `hifi-build.css`），视口 **390px**。  
分级：**P0** 结构/路径 · **P1** 字号间距 · **P2** 装饰动画

## P0 — 结构 / 层级 / 路径（必须先过）

| 项目 | Web | 小程序 | 状态 |
|------|-----|--------|------|
| 单滚动 + 底栏占位 | page-stack 单滚；input-dock 在 Tab 上 | `HiFiMainShell` page--with-input/tab | 已对齐 |
| Tab 跳转 | 四 Tab 固定 | `switchTab` in navigation.ts | 已对齐 |
| Onboarding 底 CTA | bottom-actions 玻璃卡 grid | hifi-build fixed bottom-actions | 已对齐 |
| input-dock 不被挡 | grid 行：内容 / input / tab | fixed dock @ tab-bar-height | 已对齐 |
| 画像子页 | evidence / verify | `pages/profile/evidence` · `verify` | 已对齐 |

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
| 玻璃态 blur | `backdrop-filter: blur(22px)` | `rgba(255,255,255,0.96)` + 底栏实色遮罩 | 机型不支持 blur；底栏用壳色封住漏字 |
| 页面进场 | `page-entering` + page-rise | `motion.scss` + `usePageEntering` | 已对齐 |
| section-reveal | 流式新节 | `DailySectionView` animate | 已对齐 |
| hero chipFloat | starter pills | `.pill.chip-float` | 已对齐 |
| VoiceOverlay | 深度反馈浮层 | `components/voice/VoiceOverlay` | 已对齐；ASR 不可用时打字降级 |
| 壳层 max-width | 430px 居中 phone shell | 全宽 | 微信全屏 |
| wave 录音动画 | CSS keyframes | motion.scss + VoiceOverlay / BuildRecordBox | 已对齐 |
| hifi-mascot.png | — | ~96KB（330px 长边） | 已压缩 |
| 预演 checkpoint | 每 4 轮 modal | `CHECKPOINT_EVERY = 4` | 已对齐 |
| prefers-reduced-motion | Web 已有 | motion.scss `@media` | 已对齐 |

## 已对齐（感知级）

- 全局奶油绿渐变背景
- 绿色渐变家长气泡 / 白色 AI 气泡（72% / 86% 宽比）
- 自定义玻璃态底部 Tab（`tabBar.custom`）
- Onboarding：BuildRecordBox、FollowUpCard、record-box + page-entering
- Daily hero + starter pills chipFloat + thinking 四宫格 + section-reveal
- HiFiInputZone hold-button 52px 绿渐变
- 画像 evidence / verify 导航链（profile / deep / result）

## 故意不改（登记）

| 项 | 原因 |
|----|------|
| Web CSS 本体 | 只改 MP + 文档 |
| 430px 居中 phone shell | 微信全屏产品形态 |
| 字重 820 | 平台无对应值 |
| understanding-card 独立页 | 深度展开保持气泡内联 |
| legacy Web 路由 | 不在 MP 产品范围 |

## Round3 + 像素动效收口（2026-07-10）

脚本：`npm run style-parity-audit`（含 C-motion）

| 结果 | 说明 |
|------|------|
| Token 4/4 | 品牌色、按钮高、input-dock、气泡宽比 |
| Class 含 motion | page-rise / section-reveal / page-entering |
| P2 登记 | 字重 820、玻璃 blur（机型差异） |
