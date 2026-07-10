# Web → 微信小程序 Porting 指南

**任务类型：跨端复刻（Porting），不是新做小程序。**

## 最高优先级

- 目标：**Visual Parity（用户感知一致）**——同一用户连续打开 Web 与小程序，品牌感、结构、路径、信息重点、使用感受一致。
- 实现：**设计还原 + 平台适配**（先提取 Web Design Token，再在小程序映射；参数可调，气质不可跑偏）。
- 禁止：按微信惯例重设计、静默改布局、跳过 Web 源码、未跑 P0 自检就声称完成。

## 权威来源（按顺序）

1. [DESIGN.md](../../DESIGN.md)
2. [app/hifi-app.css](../../app/hifi-app.css)、[app/profile/build/hifi-build.css](../../app/profile/build/hifi-build.css)
3. Web 页面：`app/daily/`、`src/components/hifi/`、`src/components/profile/`
4. [PRODUCT.md](../../PRODUCT.md)、流式契约 `docs/contracts/daily-stream-events.md`
5. 小程序：[README.md](../README.md)、[DESIGN-TOKENS.md](./DESIGN-TOKENS.md)
6. [web-component-map.md](./web-component-map.md)（先更新表再写代码）
7. [visual-diff.md](./visual-diff.md)（平台无法一致时必须登记）
8. **[PORTING-SELF-CHECK.md](./PORTING-SELF-CHECK.md)**（每轮完成必跑）

## 工作流

| Phase | 动作 |
|-------|------|
| 0 只读对齐 | 读 Web 页面 + class + 组件树；查 web-component-map |
| 1 Token | 更新 DESIGN-TOKENS + tokens.scss |
| 2 单页复刻 | 一次一页/组件；列改动文件与已知差异 |
| 3 感知验收 | iPhone 13 / 390 宽对照 `https://yujian.yihe.site` 同路由 |
| 3b 自检 | [PORTING-SELF-CHECK](./PORTING-SELF-CHECK.md) Step 1–7 报告；P0 不过不修下一页 |

## 迁移优先级（S 级）

| 级 | 范围 | P0 |
|----|------|-----|
| S1 | HiFiMainShell + custom-tab-bar | 背景、Tab 高度、safe-area |
| S2 | HiFiInputZone | input-dock 位置、与 Tab 不重叠 |
| S3 | pages/daily | 气泡层级、深度展开卡 |
| S4 | packageOnboarding | 心理路径 + build 页 |
| S5 | tasks / rehearsal / profile | P1 精修 |
| S6 | 全站 P2 | 阴影/动画登记 diff |

状态：`done`（结构）→ `parity-audit`（待检）→ `parity-verified`（附自检报告）

## 平台陷阱

| 陷阱 | 策略 |
|------|------|
| rpx | 390 物理宽基准：`px × 2 = rpx`（750 设计宽） |
| safe-area | `HiFiMainShell` / `bottom-actions` / tab-bar 统一 |
| navigationBar | `navigationStyle: custom` |
| button/input 默认 | `::after { border: none }`、重置 height |
| backdrop-filter | 半透明白底，登记 visual-diff |
| scroll-view | 单滚动容器；算清 input-dock + Tab 占位 |
| Tab 跳转 | `Taro.switchTab`，见 `utils/navigation.ts` |

## 验收仪式（每次迭代）

1. `cd miniprogram && npm run dev:weapp`
2. 开发者工具导入 **`miniprogram/`**（非仓库根）
3. 模拟器 **iPhone 13（390 宽）**
4. 浏览器打开 Web **同路由**
5. 至少 5 项对照：背景渐变 / Tab / 主卡片 / 输入区或 record-box / 底部 CTA
6. 无法一致 → 更新 [visual-diff.md](./visual-diff.md)（P0/P1/P2）
7. 记录到 [parity-verification-log.md](./parity-verification-log.md)

## 禁止

- 第二套设计系统
- 「小程序更适合」改信息架构
- 一次性改全站
- 只改代码不更新 visual-diff / web-component-map
