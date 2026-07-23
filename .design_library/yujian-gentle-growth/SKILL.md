---
name: yujian-gentle-growth-design
description: Use this skill to generate well-branded interfaces for 育见 Gentle Growth — a parent-facing mobile guidance product. Contains essential design guidelines, colors, type, motion, and component references for prototyping mobile-app and mini-program UIs.
user-invocable: true
---
# 育见 Gentle Growth Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts, copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without other guidance, first ask what screen or flow they want to build, then respond like a senior product designer who can output HTML artifacts or production-ready UI code.

## Quick map
- `README.md` — 品牌背景、内容语气、视觉原则与组件模式总览（先读）
- `css.json` — token 理解源；优先用它理解颜色、字体、间距、圆角与 motion
- `colors_and_type.css` — 运行时变量入口；接入样式时 link/use 它，不把它当作首选理解源
- `components/index.json` — 6 个核心组件索引与跨组件模式
- resolved component sources — 先读 `preview/component-{slug}.html`，再读 `components/{slug}.json` 看 intent/variants；若预览不足才退回 `components/_evidence/{slug}.json`
- `preview/` — 每个核心组件的小型 HTML 预览，适合拿来复刻小程序/移动端界面细节
- `ui_kits/mobile-app/` — 完整 mobile-app 参考界面，适合作为版式、密度、导航模式参考
- `library-consumption.json` — 下游推荐读取顺序与组件消费优先级

## Essentials at a glance
- Primary 回到 hi-fi 黄绿主轴：主行动作使用 `#6f9f56`（`--yujian-primary-700` / `--primary`），高光与轻强调用 `#9dcc75`（`--yujian-primary-500`），不再回到偏金棕主导。
- Surface 以 `#f8f6e5` 背景、`#fffdf7` 卡面、`rgba(255,255,247,0.78)` glass 与 `rgba(238,247,207,0.72)` glow 形成更精致层级；依赖描边和辉光语义，不依赖 `backdrop-filter`。
- Motion tokens 已入库：`160ms / 220ms / 320ms`、`cubic-bezier(0.20,0.00,0.00,1.00)`、按压缩放 `0.98`、浮动位移 `6px`，用于小程序可落地的按压、浮动、切换反馈。
- Radius `12px / 16px / 24px / 9999px` 与 control height `40px / 44px / 48px / 56px` 共同定义轻软触感；节奏基线仍是 `4px`，常用间距 `8px / 12px / 16px / 24px`。
- Typography 使用 `SF Pro Display`、`SF Pro Text`、`PingFang SC`、`Noto Sans SC`、`Menlo`；正文 `16px / 1.68` 保证家长场景长文可读，标题保持轻盈但不装饰化。
- Voice 保持“温柔可信、低压克制、清晰安静、面向家长”，像“你好，欢迎来到”“开始前说明”“用真实生活，让育见认识孩子”，不用命令式增长语气。
- Shadow philosophy 是“柔雾托起而非强悬浮”：从 `--shadow-1` 的轻纸卡到 `--shadow-4` 的浮层，配合 `glass/glow` token 做精致层次，而不是炫技深阴影。
- Signature pattern 是奶油纸感底 + 黄绿主轴 + 克制微动感：适合 mobile-app / 小程序单列内容流、底部导航与语音输入入口，不做工具盘或报告面板质感。

## Components
| Slug | Name | Key Insight |
|------|------|-------------|
| button | Primary Button | 主按钮像被轻光点亮的一步，按压时用 `0.98` 缩放与短促回弹表达鼓励，而不是催促。 |
| card | Paper Card | 卡片升级为更精致的轻玻璃纸片，用高光边、柔雾阴影与奶油底承接内容理解感。 |
| bottom-nav | Bottom Navigation | 底部导航像柔和悬浮的引导带，激活态更细腻，适合小程序与 mobile-app 的稳定单手导航。 |
| input-dock | Input Dock | 输入浮板应像被轻光托住的操作区，语音按钮是温柔主角，反馈优先考虑小程序按压可实现性。 |
| chip | Chip | 标签像柔和光点一样提示筛选与状态，完整圆角只在这里充分出现，避免系统过度甜腻。 |
| insight-card | Insight Card | 洞察卡用更精致的层次和微动线索承接“理解孩子”的结论，避免做成评测报告或硬分析卡。 |
