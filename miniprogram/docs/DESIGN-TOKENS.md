# Web Design Token → 小程序映射

**不复制 CSS 文件**；从权威源归纳，供 porting 与自检对照。

来源：[DESIGN.md](../../DESIGN.md)、[app/hifi-app.css](../../app/hifi-app.css)、[app/profile/build/hifi-build.css](../../app/profile/build/hifi-build.css)

换算基准：设计视口 **390px 物理宽** → Taro **750rpx** 设计稿 → **`1px ≈ 2rpx`**（感知可调 ±4rpx）

## 布局

| Token | Web 值 | 设计意图 | 小程序 (`tokens.scss`) |
|-------|--------|----------|------------------------|
| shell-max-width | `min(100%, 430px)` | 手机壳居中，不超平板感 | 全宽（微信无居中壳）→ visual-diff P2 |
| page-padding-x | `20px` | 内容呼吸边距 | `$page-padding-x: 20px` / `40rpx` |
| page-padding-y | `12px 20px` top/bottom | 顶松底紧 | `.page` padding 同左 |
| app-safe-top | `max(42px, safe-top)` | 刘海/状态栏 | `.app-safe-top` 同 |
| tab-bar占位 | bottom-tabs ~78px + safe | 四 Tab 固定心智 | `$tab-bar-height` |
| input-dock占位 | input-zone ~72px + tab | 交流页底部输入不挡内容 | `$input-dock-height: 72px` |
| bubble-parent-max | `min(72%, 292px)` | 家长气泡偏右、不过宽 | `72%` 比例优先 |
| bubble-ai-max | `86%` | AI 气泡近全宽 | `.bubble max-width: 86%` |

## 字体

| Token | Web | 意图 | 小程序 |
|-------|-----|------|--------|
| text-hero | 26px / lh 1.32 / w 820 | 首屏标题、信任感 | `$text-hero` / w 700 → P1 diff |
| text-title | 17px / w 780 | 卡片小标题 | `$text-title` / w 700 |
| text-body | 15px / lh 1.68 | 正文可读 | `$text-body` 同 |
| text-small | 13px / lh 1.55 | 辅助、标签 | `$text-small` 同 |
| font-family | 系统 PingFang 等 | 亲和中文 | 微信系统字体 → P1 diff |

## 颜色

| Token | Web | 意图 | 小程序 |
|-------|-----|------|--------|
| green / green-deep | `#9dcc75` / `#6f9f56` | 品牌草绿 | 直传 hex |
| green-soft | `#f1f8df` | 轻提示底 | 直传 |
| ink / ink-soft / muted | `#202633` / `#5c616d` / `#868b94` | 正文层级 | 直传 |
| card | `rgba(255,255,247,0.88)` | 奶油卡片 | 直传 |
| line | `rgba(73,91,45,0.08)` | 分隔 | 直传 |
| shell-gradient | 多层 radial + linear | 黄绿暖底、非 AI 紫 | `$shell-gradient` 同 |

## 形状

| Token | Web | 小程序 |
|-------|-----|--------|
| radius-card | 24px | `$radius-card` |
| radius-row | 20px | `$radius-row` |
| radius-control | 16px | `$radius-control` |
| radius-pill | 999px | `$radius-pill` |

## 深度（P2）

| Token | Web | 小程序 |
|-------|-----|--------|
| shadow-card | `0 14px 36px …` | `$shadow-card` |
| shadow-soft | `0 6px 18px …` | `$shadow-soft` |
| glass blur | `backdrop-filter blur(22px)` | 半透明白 → visual-diff |

## 动效（motion.scss）

| Token / 能力 | Web | 小程序 |
|--------------|-----|--------|
| page-entering | `.page.page-entering` + page-rise stagger | `usePageEntering` → HiFiMainShell / HiFiBuildShell |
| section-reveal | 流式新节 200ms | `.bubble-section.section-reveal` |
| chipFloat | starter pills | `.pill.chip-float` |
| thinking-pulse | thinking dots | `.thinking-dots-dot` |
| wave | 录音条 | `.wave-bar` |
| reduced-motion | prefers-reduced-motion | motion.scss 同策略 |

## 间距

| Token | Web (DESIGN.md) | 小程序 |
|-------|-----------------|--------|
| spacing-xs | 8px | `$spacing-xs` |
| spacing-sm | 12px | `$spacing-sm` |
| spacing-md | 16px | `$spacing-md` |
| spacing-lg | 22px | `$spacing-lg` |
| spacing-xl | 28px | `$spacing-xl` |
| section-gap | ~14px | `.message-row margin-bottom` |
| hero-padding | 24–26px | `.hero-card padding` |

## 组件尺寸

| 组件 | Web | 意图 | 小程序 |
|------|-----|------|--------|
| primary-button | min-height 48–52px | 主 CTA 好点 | `$btn-height-primary: 44px`（MP 下调，少挡正文） |
| hold-button | 52px 高，绿渐变 | 交流主操作 | HiFiInputZone 44px 实色绿 |
| chip/pill | min-height 34px | 次要选项 | `$btn-height-chip: 34px` |
| record-area | min-height 184px | onboarding 倾诉区 | hifi-build.scss |
| tab-bar | 68px + padding | 底部导航 | custom-tab-bar 56px + 实色底 |

## 映射原则

1. **颜色/圆角**：直传，不改色相  
2. **字号**：同名 token；字重 Web 780→MP 700 登记 P1  
3. **宽度**：比例优先（气泡 72%）  
4. **无法实现**：写 visual-diff，标 P0/P1/P2

## Onboarding 信息页（intro 单页 · 2026-07-19）

真源：`onboarding-info-compare.html` Impeccable 修正版 → [`onboarding-info.tokens.scss`](../src/styles/onboarding-info.tokens.scss)

| Token | 值 | 说明 |
|-------|-----|------|
| page-bg | `#fff8dc → #e8f2dc` 180deg | 与 login/build 同系 |
| card-radius | 16px | 非 build `$radius-card` 24px |
| body | 15px / lh 1.68 | 长文可读 |
| title | 28px / lh 1.34 | 段标题 |
| brand | 34px / lh 1.2 | 「育见」 |
| cta | 54px / `#84b76c` | visual-diff P1 vs 全局 44px 按钮 |
| example tones | gentle/vent/rational… | 仅底色+边框+引号色，无左色条 |
