---
name: ChildOS 心镜
description: 给家长一面温柔的回声——理解青春期孩子的 AI 产品
colors:
  primary: "#6E6AF8"
  primary-hover: "#625EF0"
  primary-light: "rgba(110, 106, 248, 0.12)"
  primary-glow: "rgba(240, 239, 255, 0.58)"
  page-bg: "#F8F8FA"
  card-bg: "rgba(255, 255, 255, 0.78)"
  glass: "rgba(255, 255, 255, 0.72)"
  glass-strong: "rgba(255, 255, 255, 0.82)"
  text-primary: "#1D1D1F"
  text-secondary: "#6E6E73"
  text-tertiary: "#A1A1A6"
  border: "rgba(29, 29, 31, 0.08)"
  border-light: "rgba(29, 29, 31, 0.04)"
  cream-line: "rgba(29, 29, 31, 0.06)"
  danger: "#e45a5a"
  success: "#4f9f72"
  warning: "#d98b2b"
  overlay: "rgba(0, 0, 0, 0.24)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "clamp(26px, 7.3vw, 30px)"
    fontWeight: 850
    lineHeight: 1.24
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: "32px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "34px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
rounded:
  sm: "14px"
  md: "16px"
  card: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "52px"
  chip:
    backgroundColor: "rgba(110, 106, 248, 0.06)"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: "38px"
  entry-card:
    backgroundColor: "{colors.card-bg}"
    rounded: "20px"
    padding: "16px"
  voice-bar:
    backgroundColor: "{colors.glass}"
    rounded: "24px"
    padding: "12px 16px"
  nav-tab:
    backgroundColor: "{colors.glass}"
    rounded: "22px"
    padding: "6px"
---

# Design System: ChildOS 心镜

## 1. Overview

**Creative North Star: "即时回声"**

心镜不是一个需要"打开、浏览、学习"的产品。它是一个家庭场景中的即时工具——你遇到一个具体时刻（孩子又拖了、你马上要开口说一句话、刚刚吵完不知道该不该回头聊），打开它、说一段、得到一个更深的理解，然后关掉。

设计不是让用户"沉浸在这个产品里"，而是让产品在用户需要时出现，不需要时消失。每一个页面都应该在 10 秒内完成它的任务：要么输入，要么理解，要么决定下一步。

这个系统明确拒绝：长篇文字说明、复杂的多级菜单、任何暗示"你需要学会怎么用"的设计。系统固定文案能省则省，宁可用 UI 布局和按钮本身引导，也不要靠分段说明教育用户。

AI 输出的交互文案则是另一个标准：它需要有呼吸感、有层次，让焦虑的家长读得下去。段落不要太密、行高不能太紧、内容要分段——不是"写得更少"，而是"让同样的信息更好读"。

**Key Characteristics:**
- 低认知负担：每一屏只做一件事
- 暖而不热的白色基调：不是纯白，是带微弱调性的浅灰白
- 品牌色只在高关注位置出现，不铺满
- 玻璃质感卡片浮在浅灰白背景上，像薄纸叠在薄纸上
- 系统文案最小化，UI 引导最大化

## 2. Colors

整个调色板围绕一个中心展开：柔和的紫暮色作为唯一强调色，深浅灰白作为呼吸空间。

### Primary
- **宁静的暮色** (#6E6AF8): 品牌色。像傍晚天空的最后一抹紫，安静、可信。仅用于按钮背景、选中态导航、追问提示徽标、少量高关注元素。不在大面积背景或装饰中使用。

### Neutral
- **雾白底** (#F8F8FA): 页面背景。不是纯白，带极微弱的暖灰调，避免临床感。
- **半透纸** (rgba(255, 255, 255, 0.78)): 卡片背景。微微透出底色，像薄纸叠在另一张薄纸上。
- **毛玻璃** (rgba(255, 255, 255, 0.72)): 输入区、导航条背景。更透，有 backdrop-filter 模糊。
- **深墨色** (#1D1D1F): 正文颜色。几乎黑色但带一丝暖意，不是冷 #000。
- **石板灰** (#6E6E73): 次级文字、辅助说明。有温度的中灰色，不冷。
- **雾灰** (#A1A1A6): 三级文字、占位符、时间戳。淡到几乎消失，不抢注意力。
- **极淡线** (rgba(29, 29, 31, 0.04-0.08)): 边框和分割线。几乎看不见的分隔，靠间距和布局区分区域。

### Functional
- **警示红** (#e45a5a): 仅用于错误提示和录音中状态。
- **确认绿** (#4f9f72): 仅用于完成标识。
- **注意橙** (#d98b2b): 仅用于警告提示。

### Named Rules
**The One Voice Rule.** 品牌色（宁静的暮色）在任一屏幕上占比不超过 10%。它是一盏小灯，不是一面墙。一旦铺满或重复出现，它就失去了"这里很重要"的信号能力。

**The No-Cold-Gray Rule.** 禁止在浅色背景上使用纯冷灰色（#9CA3AF 系）。所有的灰都是暖调的——次级文字用降低透明度的深墨色或石板灰，确保文字在白色背景上保持温暖感，而不是临床感。

**The No-Pure-White Rule.** 禁止 #FFFFFF 作为大面积背景。页面背景（#F8F8FA）和卡片背景（0.78 opacity 白色）都带着极微弱的暖调。纯白只有在极端需要对比时作为例外出现（比如白色按钮上的深色文字）。

## 3. Typography

**Font Stack:** 系统原生字体栈：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`。不引入外部网络字体，保证移动端加载速度和原生渲染质量。

**Character:** 单字族策略——全站只用系统无衬线体，靠字重（400 / 600 / 700 / 800 / 850）和字号区分层级。不配对的克制选择，体现"简洁"原则。

### Hierarchy
- **Display** (850, clamp(26px, 7.3vw, 30px), 1.24): 首页语音卡片中的大标语、核心追问。仅在最高关注度的单一信息区域使用。
- **Heading** (800, 27px, 32px): 首页产品名和关键标题（当前版本已移除首页标题，保留在登录页和模块卡片中）。
- **Title** (700, 26px, 34px): 页面主标题。每个一级页面的顶部标题。
- **Subtitle** (650, 16-17px, 24px): 辅助引导文字。页面标题下方的简短说明。
- **Body** (400, 15px, 24px): 正文。AI 输出主体、卡片内描述文字。行高 24px 在移动端阅读舒适。
- **Small Body** (400, 13-14px, 20-22px): 辅助说明、时间戳、次要信息。
- **Label** (700, 12px, 16px): 导航标签、按钮文字、徽标。

### Named Rules
**The Breathing Room Rule.** AI 输出的正文段落之间至少留一行间距（16-20px）。行高不低于 1.5。不让焦虑的家长面对一堵密不透风的文字墙。好的输出应该是可以逐段消化的，不是一整块砸下来的。

**The No-Tiny-Text Rule.** 任何面向家长的正文文字不小于 13px。次级说明文字（如"已完成"标签、"1/5"进度）可以到 12px，但不能再小。家长是在手机上看的，不是在 Retina 屏幕上审稿。

## 4. Elevation

这个系统的深度感来自透明度和模糊，而不是阴影。

**哲学：轻呼吸。** 所有表面都微微浮在背景之上，像薄纸叠在另一张薄纸上。底层的浅灰白色（#F8F8FA）是"桌面"，上面的半透明卡片（0.72-0.78 opacity）是叠放的纸张。背景隐约透过来，形成自然的层级感，不需要重阴影来区分。

### Shadow Vocabulary
- **卡片浮影** (0 1px 3px rgba(0,0,0,0.05)): 静态卡片。极浅的影子，几乎看不见，主要是让圆角卡片的边缘在浅背景上被感知到。
- **微浮** (0 2px 8px rgba(0,0,0,0.06)): 语音输入麦克风按钮。稍有体量感，暗示可以按下。
- **品牌光晕** (0 2px 8px rgba(110,106,248,0.18)): 主按钮、麦克风录音中状态。品牌色的影子，是唯一带有彩色成分的阴影。
- **抽屉/弹层** (0 12px 32px rgba(24,24,32,0.08)): 底部弹出的抽屉面板。更大的模糊半径，明确区分弹出层和底层。

### Named Rules
**The Float-By-Default Rule.** 卡片在默认状态下不使用可感知的阴影。表面间的区分靠背景透明度差异和极浅的边框（0.04-0.08 opacity），而不是阴影。阴影只在交互反馈和弹出层中出现。

**The Shadow-Light Rule.** 所有阴影的模糊半径都不超过其 y-offset 的 4 倍。短而紧的阴影感觉像真实的物理抬升；长而散的阴影感觉像光晕滤镜。这个系统选前者。

## 5. Components

### Buttons
- **Shape:** 圆角 16px，全宽按钮。
- **Primary** (主按钮): 宁静的暮色 (#6E6AF8) 背景，白色文字，52px 高度。带品牌光晕阴影。Hover/Active 缩放到 0.985。Disabled 变为浅灰背景 (#e6e7ef) + 灰色文字。
- **Secondary** (次按钮): 半透明白色背景 (0.72 opacity)，品牌色文字，1px 极淡边框。Hover/Active 缩放到 0.985。
- **Loading State:** 文字替换为"正在整理..."，左侧出现旋转 spinner。按钮变为 disabled 状态。

### Chips / Tags
- **Style:** 品牌色 6% 透明背景，品牌色文字，1px 品牌色 14% 透明边框。全圆角 (999px)，内边距 8px 12px。
- **用途:** 页面中的输入提示标签（如"催作业""聊成绩"），不可点击，仅作信息提示。
- **完成标签:** 绿色文字 + 绿色图标，品牌色 6% 背景。

### Cards / Containers
- **圆角风格:** 对话框/内容卡片 28px，功能入口卡片 20px，信息卡片 24px。
- **背景:** 半透明白色 (0.72-0.78 opacity)，带 1px 极淡边框。不带阴影在默认状态。
- **内边距:** 统一 16-24px，根据内容密度选择。
- **卡片原则:** 一个视图只用一个层级的卡片。不嵌套卡片。

### Inputs / Voice Bar
- **语音条 (voice-bar):** 固定在页面底部，半透明白色背景 (0.74 opacity)，顶部圆角 24px。包含：上方一行提示文字 (13px 灰色)，中间三个区域——左侧键盘切换按钮，中心麦克风按钮 (60px 圆形，品牌色)，右侧空白占位。
- **文字输入面板:** 在语音条内展开，包含 textarea（最小 92px 高度）和两个按钮（清空 + 说完了）。
- **首页文字输入:** 独立于语音条，固定在底部导航上方。搜索框 + 发送按钮，更轻量。
- **Focus:** 无特殊 focus 环，靠按钮自身的颜色变化和缩放反馈。

### Navigation
- **底部导航 (talk-tabs):** 固定在页面最底部 (bottom: 12px)，半透明白色背景 (0.68 opacity)，圆角 22px，backdrop-filter 模糊。4 个等宽按钮分区，图标 + 标签（12px 字）。
- **Active State:** 品牌色文字 + 品牌色 8% 背景 + 1px 品牌色 12% 边框。采用圆角 19px 的胶囊形选中背景。
- **页头返回:** 40px 方形圆角按钮，半透明白色背景，左侧返回箭头。标题 17px/600 字重。

### Signature Component: 语音卡片 (talk-card)
系统的视觉核心。首页最显眼的区域。248px 最小高度，圆角 28px，半透明白色背景 (0.72 opacity)，1px 边框。内部三部分：顶部状态行（品牌色小圆点 + "心镜语音捕捉" + 计时器），中间大字区域（显示实时转写文字或引导语），底部音频控制条（音量可视化条 + 计数 + 播放/录音按钮）。

## 6. Do's and Don'ts

### Do:
- **Do** 用品牌色 (#6E6AF8) 作为页面上唯一的强调色，且每屏不超过 10% 面积。
- **Do** 用半透明卡片 (0.72-0.78 opacity) 叠在浅灰白背景 (#F8F8FA) 上，靠透明度差异区分层级，不靠阴影。
- **Do** 系统固定文案尽量少，用页面布局、按钮位置、占位符文字自然引导用户操作。
- **Do** AI 输出正文保持 15px/24px 行高，段落间距不低于 16px，让长内容分层、有呼吸感。
- **Do** 移动端按 iPhone 13 (390×844) 视口优先设计，所有按钮不小于 44px 触摸目标。
- **Do** 语音输入作为所有文本输入区的主入口，键盘输入作为可展开的辅助方式。
- **Do** 每个页面只做一件事：输入、理解、决定下一步。不在一屏堆多个任务。

### Don't:
- **Don't** 嵌套卡片。卡片里不放卡片，信息靠间距和标题分层。嵌套卡片始终是错误的。
- **Don't** 在浅色背景上使用冷灰色文字 (#9CA3AF 系)。所有次级文字用暖调灰 (#6E6E73, #A1A1A6) 或降低透明度的深色。
- **Don't** 使用 #FFFFFF 作为大面积背景。页面底色始终是 #F8F8FA 或半透明白。
- **Don't** 在界面中出现任何评分、星级、进度百分比、达标/未达标暗示。"完成"用一个小绿色勾（不是分数），"未完成"不标记。
- **Don't** 用大于 3 行的系统说明文字引导用户操作。如果用户需要通过读说明来理解功能，说明 UI 设计没到位。用一个占位符、一个按钮名、一个布局引导就够了。
- **Don't** 让机械的 AI 感外显。不要出现"Agent""模型""API"等技术名词。不要出现类似 ChatGPT 的通用对话界面感觉。产品是一个家庭工具，不是一个 AI 聊天框。
- **Don't** 让学生感的设计出现。不统一的圆角、随意拼凑的颜色、潦草的间距、混乱的字号——这些粗糙痕迹会直接摧毁家长对这个产品的信任。
- **Don't** 像心理测评工具。不出现任何"你的得分""你的水平""对比同龄人"的暗示。不给家长压力感。
