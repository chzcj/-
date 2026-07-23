# 育见 Gentle Growth Design System

A refined design system for **育见** — 一套服务家长的陪伴型移动产品视觉语言。
This version is intentionally tuned for a mini-program-ready front-end code system, so every refinement must同时满足温柔陪伴、精致感与可落地实现。

## Overview

这次 refine-library 不是重新定义品牌，而是把既有气质进一步收束为更适配小程序前端设计代码系统的细化版。品牌分析里稳定出现的关键词是“温柔可信、低压克制、陪伴感、清晰安静、面向家长”，因此这套系统不追求夸张记忆点，而是追求一种轻盈、细腻、柔和动感的陪伴体验：它应该像被轻轻托住，而不是被功能推着走。

与早期更偏暖金棕的印象相比，当前版本已经明确把主色重新与 hi-fi 黄绿系对齐。设计中心从 `--yujian-primary-500: #9dcc75`、`--yujian-primary-600: #84b863`、`--yujian-primary-700: #6f9f56` 这组黄绿主轴展开，辅以 `--yujian-accent-400: #e7cb78` 与 `--yujian-accent-500: #dcb463` 作为暖意点缀，而不再让金棕成为视觉中心。换句话说，暖感仍然存在，但它退回到陪衬位置，主情绪已经回到更清澈、更安心的黄绿 hi-fi 体系。

精致感的来源也被重新定义。它不来自重玻璃、重模糊或复杂特效，而来自更干净的边框、更克制的高光边、浅玻璃面、柔和辉光与轻动态 token 的组合。`--glass-surface: rgba(255,255,247,0.78)`、`--glass-stroke: rgba(255,255,255,0.66)`、`--glow-soft: rgba(238,247,207,0.72)` 与 `--glow-strong: rgba(157,204,117,0.24)` 共同说明：这套系统想要的是“被光轻轻拂过”的精致，而不是“被滤镜包住”的炫技。

## Source

- **Current library basis:** `colors_and_type.css`, `components/index.json`, `components.css`, `preview/*.html`
- **Mini-program alignment basis:** `miniprogram/src/styles/tokens.scss`
- **Brand narrative basis:** `phase2-brand-analyst.json`
- **Product owner:** 育见

## What this design system covers

- **Foundations** — hi-fi 黄绿主色、奶油中性色、浅玻璃面、轻辉光、字重清晰的移动端文本层级、可映射到小程序代码的圆角/间距/动效 token
- **Components** — 6 个已索引组件，覆盖 actions、surfaces、navigation、inputs、micro-components、content-patterns
- **Sample UI kit** — `ui_kits/mobile-app/index.html`，用于验证单列移动端布局与细腻层次是否一致

## CONTENT FUNDAMENTALS

### Voice & tone

育见的语言不是咨询行业的话术，也不是效率工具的命令口吻。它先陪伴，再说明，再引导动作；先帮助家长放下防备，再邀请他们继续往前。文案因此应该短、轻、稳，不制造判断压力，也不使用过强的“解决问题”语气。阅读体验要像一次安静的对话，而不是一次被安排好的流程。

### Concrete copy examples

- 欢迎场景：`你好，欢迎来到`
- 产品识别：`育见`
- 进入前缓冲：`开始前说明`
- 品牌价值表达：`用真实生活，让育见认识孩子`
- 单一主行动作：`开始`

### When generating copy

- 先安顿情绪，再交付信息；先说“欢迎”或“说明”，再说“开始”或“下一步”。
- 用词偏陪伴型动词，如“认识、理解、陪你、一起看见”，避免“测评、管理、诊断”这类高压词。
- CTA 维持单一且直给，避免把多个承诺塞进一个按钮。
- 说明性文案保持温和、清晰、口语化，避免宣传腔和知识灌输感。

## VISUAL FOUNDATIONS

### Color

当前版本最重要的变化，是主色明确回到与 hi-fi Web / 小程序一致的黄绿系统，而不再停留在偏金棕的暖黄印象。`--yujian-primary-500: #9dcc75` 是系统里最有辨识度的明亮黄绿，`--yujian-primary-700: #6f9f56` 则承担更稳的强调与链接表达，配合 `--primary: var(--yujian-primary-700)` 与 `--accent: var(--yujian-primary-500)`，形成“安静但有生命力”的主情绪。小程序侧的 `$green: #9dcc75`、`$green-deep: #6f9f56`、`$green-soft: #f1f8df`、`$mint: #eef7cf` 完整验证了这一主轴已经与代码实现对齐。

暖色不再是中心，而是温度补充。`--yujian-accent-400: #e7cb78`、`--yujian-accent-500: #dcb463` 对应小程序里的 `$butter: #f6edb4` 与 `$butter-soft: #fbf7dc`，更适合做局部提示、内容烘托与情绪提亮，而不是通篇主视觉。这样处理以后，界面的温柔感不再依赖金棕色的厚重，而来自黄绿与奶油底色的轻层次。

中性色体系同样服务“陪伴感”。`--background: #f8f6e5`、`--surface: #fffdf7`、`--surface-container: #faf8ee`、`--surface-container-high: #f5f2e7` 构成一种略带奶油纸感的底面关系，不冷白、不灰脏，也不做高反差层级。正文色使用 `--foreground: #202633`，次级文本落在 `--muted: #5c616d` 与 `--muted-foreground: #7a8172`，阅读上更像清晰整理过的生活记录。

### Typography

字体策略以系统字为先，优先保证移动端与小程序的稳定渲染。展示级使用 `SF Pro Display` 与 `PingFang SC` 的组合，标题与正文使用 `SF Pro Text`、`PingFang SC`、`Hiragino Sans GB`、`Microsoft YaHei`、`Noto Sans SC` 的回退链，意味着这套系统不依赖单一品牌字，而是用更稳的系统字获得“自然、细腻、可读”的界面气质。英文与数字依然保持苹果系字面节奏，中文则通过 `PingFang SC` / `Noto Sans SC` 承担主体阅读。

字阶也明显为移动端服务。运行时 token 里，display 为 `32px / 1.22 / 700`，H1 为 `27px / 1.28 / 700`，H2 为 `23px / 1.32 / 600`，H3 为 `20px / 1.38 / 600`，H4 为 `18px / 1.45 / 600`，body 为 `16px / 1.68 / 400`，lead 为 `17px / 1.62 / 500`，caption 为 `13px / 1.50 / 500`。小程序 token 里的 `$text-hero: 26px`、`$text-title: 17px`、`$text-small: 13px` 也说明最终实现将大标题、正文与说明收束在非常稳定的阅读尺度里，不追求夸张的品牌标题冲击。

### Spacing

间距系统沿用轻量、稳定、易编码的移动端节奏。设计系统 token 为 `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px`，小程序进一步以 `$spacing-xs: 8px`、`$spacing-sm: 12px`、`$spacing-md: 16px`、`$spacing-lg: 22px`、`$spacing-xl: 28px` 补足页面级布局需要。这里的重点不是绝对数学整齐，而是让卡片、段落、按钮与输入区在手持设备上保持温和呼吸，不会因为过密而变成功能面板。

控件高度同样偏舒展。运行时按钮高度是 `44 / 48 / 56px`，输入高度是 `40px`；小程序里主按钮高度是 `$btn-height-primary: 44px`，输入 dock 总高度是 `$input-dock-height: 64px`，页面左右留白是 `$page-padding-x: 20px`。这说明系统优先保证点击安全区、阅读停顿与情绪稳定感，而不是做极限信息密度。

### Radius

圆角是“温柔”最直观的结构信号，但当前版本已经从“大而软”调整为“有层次的软”。运行时 token 给出 `--radius-sm: 12px`、`--radius-md: 16px`、`--radius-lg: 24px`、`--radius-full: 9999px`，对应小程序侧的 `$radius-inner: 12px`、`$radius-control: 16px`、`$radius-row: 20px`、`$radius-card: 24px`、`$radius-pill: 999px`。这组值说明：微型容器和内嵌层保持 12px，交互控件稳定在 16px，列表行与浅卡面可以收在 20px，主要卡片维持 24px，真正需要“被托住”的 CTA、导航与输入结构才使用全胶囊。

这种做法比全局大圆角更精致，因为它让软感有秩序。用户不会觉得界面“糯”，而会觉得边界被处理得很干净、很照顾手感。

### Shadow / Elevation

阴影不是为了制造强烈漂浮，而是为了给纸感表面一点呼吸。`--shadow-1: 0 4px 12px -6px rgba(67,82,48,0.12), 0 1px 2px 0 rgba(67,82,48,0.06)` 适合静态卡片，`--shadow-2: 0 10px 24px -12px rgba(67,82,48,0.16), 0 2px 6px 0 rgba(67,82,48,0.08)` 适合重点容器，`--shadow-3: 0 18px 36px -18px rgba(67,82,48,0.18), 0 4px 10px 0 rgba(67,82,48,0.08)` 开始进入浮动语境，而 `--shadow-4`、`--shadow-5` 只保留给更高层覆盖关系。

精致感并不来自重阴影，而来自浅阴影与细描边的配合。小程序侧的 `$shadow-card: 0 14px 36px rgba(31, 39, 51, 0.06)`、`$shadow-soft: 0 6px 18px rgba(31, 39, 51, 0.05)`、`$shadow-lift: 0 2px 8px rgba(31, 39, 51, 0.04)` 进一步说明：落地实现更偏“柔雾阴影”，不偏“厚重投影”。

### Borders & Backgrounds

这次细化版最值得强调的，是边框终于承担了“精致”的核心责任。`--border: rgba(116,136,92,0.16)` 提供基本分隔，`--rule: rgba(116,136,92,0.12)` 适合更轻的结构线，`--outline: rgba(255,255,255,0.72)` 与 `--outline-variant: rgba(214,223,203,0.88)` 则给容器带来一层非常克制的高光边。于是卡片不需要厚重描边，也能显得清爽、干净、被打磨过。

背景处理同样遵循“浅透明面 + 细描边 + 柔雾阴影”的逻辑。系统明确提供 `--glass-surface`、`--glass-stroke`、`--color-glow-soft`、`--color-glow-strong`，但并不要求 `backdrop-filter`。这一点非常重要：我们优先使用浅透明面与边界层次来表达精致感，而不是依赖模糊背景。对小程序来说，这种方案更稳定、更一致，也更容易维持跨端视觉控制。

### Animation

动感是存在的，但它必须是克制的。运行时 token 只提供 `--motion-duration-fast: 160ms`、`--motion-duration-base: 220ms`、`--motion-duration-slow: 320ms`，并使用 `--motion-press-scale: 0.98`、`--motion-float-distance: 6px` 来约束交互反馈。也就是说，这套系统要的是短时、轻缩放、轻位移、轻浮动，而不是长时间过渡、夸张回弹或大范围漂移。

这种收束特别适合小程序：动画应该像呼吸一样提醒用户“这里可点、这里被接住了”，而不是成为额外观看负担。若一个动效不能在 160–320ms 内完成主要表达，它大概率就已经超出这套系统的合适范围。

### Iconography

图标尺寸被控制在 `16 / 20 / 24px` 三档，说明系统希望图标承担方向提示、状态提示和轻量功能识别，而不是成为主视觉主体。结合现有组件目录，图标主要服务于底部导航、按钮、输入入口与内容提示，因此更适合使用轮廓清晰、重心稳定、角部略柔和的绘制方式。

图标语言也应保持“陪伴型”而不是“工具型”。它可以清楚，但不要锋利；可以有存在感，但不要压过文本。

## Component Patterns

| Component | Preview | Contract | CSS Source | Key Facts | Key Insight |
|---|---|---|---|---|---|
| Primary Button | `preview/component-button.html` | `components/button.json` | `components.css` | `actions` 类；3 个变体；high priority；高置信度 | 主按钮应该像被轻轻点亮的一步。精致感来自干净高光边、柔和辉光与轻按压反馈，而不是厚重填充。 |
| Paper Card | `preview/component-card.html` | `components/card.json` | `components.css` | `surfaces` 类；3 个变体；high priority；高置信度 | 卡片不再只是纸感白卡，而是更接近浅玻璃纸片：细描边、浅透明面、柔雾阴影共同建立精致层次。 |
| Bottom Navigation | `preview/component-bottom-nav.html` | `components/bottom-nav.json` | `components.css` | `navigation` 类；2 个变体；high priority；高置信度 | 底部导航像轻轻悬浮的引导带。激活态应更细腻、更稳定，而不是突然跳亮或强烈放大。 |
| Input Dock | `preview/component-input-dock.html` | `components/input-dock.json` | `components.css` | `inputs` 类；3 个变体；high priority；高置信度 | 输入区像被轻光托住的操作浮板。适合使用浅玻璃面与轻阴影，让语音入口显得自然可信。 |
| Chip | `preview/component-chip.html` | `components/chip.json` | `components.css` | `micro-components` 类；3 个变体；medium priority；高置信度 | 标签应该像柔和光点一样提示状态。它的精致感来自薄边界与小幅色差，而不是强硬切换感。 |
| Insight Card | `preview/component-insight-card.html` | `components/insight-card.json` | `components.css` | `content-patterns` 类；2 个变体；medium priority；中等置信度 | 洞察卡需要用更精致的层级和微动线索承接“理解感”，避免做成报告卡、结论卡或评估卡。 |

## Index

- `README.md` — 当前设计系统的品牌叙事与落地准则
- `colors_and_type.css` — 颜色、字体、字号、间距、圆角、阴影、动效 token 的运行时入口
- `css.json` — 从 CSS 投影出的结构化 token 数据
- `components.css` — 聚合后的组件样式来源
- `components/index.json` — 当前组件索引与跨组件线索
- `preview/` — 组件预览 HTML
- `ui_kits/mobile-app/index.html` — 移动端场景化展示页
- `SKILL.md` — 设计系统入口说明

## Caveats / known substitutions

1. 小程序与 Web 的视觉能力并不完全相同，因此这套系统优先保证“可实现”和“一致性”，再追求更强的玻璃感或更明显的动效表现。若两端能力冲突，以更稳定、可复现的小程序实现为准。
2. 本系统明确不依赖 `backdrop-filter`。所有轻玻璃感都应优先通过浅透明面、细描边、柔雾阴影与高光边完成，而不是依赖实时背景模糊。
3. 暖金色仍然存在于 accent 层，但它已经不是主色中心。后续扩展若重新把主视觉拉回金棕，会破坏当前与 hi-fi 黄绿系、小程序 token 的对齐关系。
4. 字体以系统字链为主，不同平台会在 `SF Pro Display`、`SF Pro Text`、`PingFang SC`、`Noto Sans SC` 等字体间回退，因此字面细节可能略有差异；设计验收应优先看层级与节奏，而不是单一字体的绝对笔形。
5. 动效 token 已经刻意收窄为短时、轻缩放、轻位移、轻浮动。若在组件实现里加入大范围漂移、长时 easing 或明显弹跳，即使视觉上更“活”，也会偏离这套适合小程序的克制动感。
