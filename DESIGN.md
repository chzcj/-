---
name: 育见 ChildOS
description: 给家长一面温柔的回声——理解青春期孩子的 AI 产品（hi-fi 四 Tab 主站）
colors:
  primary: "#6f9f56"
  primary-hover: "#5f8f48"
  primary-light: "rgba(157, 204, 117, 0.18)"
  primary-glow: "rgba(238, 247, 207, 0.72)"
  page-bg: "#f8f6e5"
  card-bg: "rgba(255, 255, 247, 0.88)"
  glass: "rgba(255, 255, 247, 0.88)"
  glass-strong: "rgba(255, 255, 255, 0.92)"
  text-primary: "#202633"
  text-secondary: "#5c616d"
  text-tertiary: "#868b94"
  border: "rgba(73, 91, 45, 0.08)"
  border-light: "rgba(73, 91, 45, 0.05)"
  cream-line: "rgba(73, 91, 45, 0.08)"
  danger: "#e45a5a"
  success: "#6f9f56"
  warning: "#d98b2b"
  overlay: "rgba(32, 38, 51, 0.24)"
  accent-butter: "#f6edb4"
  accent-mint: "#eef7cf"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "clamp(24px, 6.5vw, 26px)"
    fontWeight: 800
    lineHeight: 1.28
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "24px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "24px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "1.68"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
rounded:
  sm: "12px"
  md: "16px"
  card: "24px"
  row: "20px"
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
    backgroundColor: "rgba(157, 204, 117, 0.12)"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: "38px"
  entry-card:
    backgroundColor: "{colors.card-bg}"
    rounded: "20px"
    padding: "16px"
  input-dock:
    backgroundColor: "{colors.glass}"
    rounded: "24px"
    padding: "12px 16px"
  nav-tab:
    backgroundColor: "rgba(255, 255, 247, 0.82)"
    rounded: "22px"
    padding: "6px"
---

# Design System: 育见（ChildOS / 心镜）

> **线上主站**：hi-fi 四 Tab（`HiFiMainShell` + `app/hifi-app.css`）  
> **CSS 真源**：`design-reference/extracted/2-main-app.css` → `npm run prebuild` 生成 scoped CSS  
> **像素参考**：[`design-reference/README.md`](design-reference/README.md)  
> **产品边界**：[`PRODUCT.md`](PRODUCT.md) · **流式契约**：[`docs/contracts/daily-stream-events.md`](docs/contracts/daily-stream-events.md)  
> **记忆契约**：[`docs/contracts/memory-read.md`](docs/contracts/memory-read.md) · [`docs/contracts/read-contract.md`](docs/contracts/read-contract.md)  
> **深度建模宪法**：[`docs/product/deep-modeling.md`](docs/product/deep-modeling.md)

**已废弃、勿再恢复**：旧版紫色心镜 `AppShell` + `BottomNavTabs` 六 Tab 布局（`/home` 等）。旧路由由 `middleware.ts` 重定向至 `/daily`。

---

## 1. Overview

**Creative North Star: 「即时回声」**

育见不是一个需要「打开、浏览、学习」的产品。它是家庭场景中的即时工具——你遇到一个具体时刻（孩子又拖了、你马上要开口、刚刚吵完不知道该不该回头聊），打开它、说一段、得到一个更深的理解，然后关掉。

设计不是让用户「沉浸在这个产品里」，而是让产品在用户需要时出现，不需要时消失。每一屏都应该在 10 秒内完成它的任务：要么输入，要么理解，要么决定下一步。

**设计如何服务「深度了解孩子」**

UI 不展示「记忆库」「Agent」等术语，但每个关键组件都应对应记忆层里的真东西——让家长感觉「它记得我家发生的事」，而不是在跟通用聊天机器人说话。

| 设计意图 | UI 表现 | 记忆来源 |
|----------|---------|----------|
| 系统在「读你家孩子」 | thinking 四宫格 chips | `dailyPortraitRefresh` → `thinkingChips`（digest 转人话） |
| 分析有证据 | prose 引用场景/习惯；section 卡正文 | `entryFacts` · `anchoredFacts` · `matchedMechanisms` |
| 这话被记住了 | `memory-label-tag`「已记住」/「这次先记在对话里」 | `GET /api/daily/memory-status` ← `memory_write` job |
| 还能更深 | `DailyDeepExpandCard` / understanding-card | hidden section + `section-llm-enrich`（读 retrievalPack） |
| 权威但不诊断 | `AuthorityInsightCard` | `deepModelDigest.mechanismNarrative`、模块 summary |
| 家庭张力（非标签） | `StructuralTensionCard` | `deep_model_digest.structuralTensions` |
| 画像在生长 | 画像卡 progress + `progressHint` | hub `completeness` · `portraitCards` 是否有实内容 |
| 上次整理时间 | 画像 Tab「上次整理：…」 | hub `refreshedAt` ← `daily-refresh` |
| 预演像我家孩子 | 预演结束解读卡 | digest `childQuotes` + `interactionLoops` |
| 按住说话 = 喂记忆 | `HiFiInputZone` + `VoiceHoldLiveBanner` | 转写文本 → 当轮 `turn_events` → 可能 `memory_write` |
| 建档是建模起点 | intro tags + hub `entry-row` | 四模块 → `entry_evidence` → SecondMe 首版 |

**组件设计原则（记忆相关）**

1. **Never fake memory**：空画像不用假模板填充；loading 用「正在整理今日画像」等真实状态文案（`daily-refresh` 兜底字段）。
2. **Evidence visible**：长 prose 可沉浸，但 section 卡与 insight 卡应让家长看到「从你家事实推出」的结构。
3. **Progress = completeness**：画像进度条反映 hub 真实收集度，不是游戏化 XP。
4. **Pre-rehearsal needs digest**：预演 UI 在 digest 未就绪时仍可用，但 copy 应收敛野心，避免无证据的「孩子会一定…」。

**hi-fi 主站特征（2026-06 起）：**

- **黄绿暖调**：草地绿 + 奶油黄渐变底，亲和、非临床、非「AI 聊天框」
- **四 Tab 固定心智**：交流｜任务｜预演｜画像
- **交流页即主场**：对话线程 + 底部 `input-dock`，不是独立「首页语音大卡」
- **流式优先**：thinking 四宫格 → prose 气泡 → section 卡片 → actions，系统 UI 退后

**明确拒绝：** 长篇系统说明、复杂多级菜单、评分/测评暗示、冷灰临床感、学生手搓廉价感、ChatGPT 式万能对话框。

**Key Characteristics:**

- 低认知负担：每一屏只做一件事
- 暖黄绿基调：不是纯白，是带自然感的浅奶油底
- 品牌绿只在高关注位置出现，不铺满
- 卡片浮在渐变背景上，轻阴影 + 半透明纸感
- 系统文案最小化，UI 引导最大化

---

## 2. Colors

调色板以 **草地绿** 为唯一主强调色，**奶油黄/薄荷绿** 为氛围辅色。实现 token 见 `.hifi-app-root`（`app/hifi-app.css`）。

### Primary（品牌绿）

| Token | 值 | 用途 |
|-------|-----|------|
| `--green` | `#9dcc75` | 主按钮、选中 Tab、关键徽标 |
| `--green-deep` | `#6f9f56` | 按下态、深强调、focus ring |
| `--green-soft` | `#f1f8df` | 浅绿底、chip 背景 |
| `--mint` | `#eef7cf` | 渐变氛围 |
| `--butter` / `--butter-soft` | `#f6edb4` / `#fbf7dc` | 暖黄点缀、权威卡背景 |

### Neutral（文字与表面）

| Token | 值 | 用途 |
|-------|-----|------|
| `--ink` | `#202633` | 正文主色 |
| `--ink-soft` | `#5c616d` | 次级说明 |
| `--muted` | `#868b94` | 占位符、时间戳 |
| `--card` | `rgba(255,255,247,0.88)` | 卡片/气泡底 |
| `--line` | `rgba(73,91,45,0.08)` | 分割线 |

### Page Background

`app-shell` 使用多层 radial + linear 渐变（`#fbfaec` → `#f6f4e6`），**禁止**大面积纯白 `#FFFFFF` 作页面底。

### Functional

- **警示红** `#e45a5a`：错误、录音取消提示
- **确认绿** `#6f9f56`：完成标识（非分数）
- **注意橙** `#d98b2b`：轻警告

### Named Rules

**The One Voice Rule.** 品牌绿在任一屏幕上占比不超过 10%。它是一盏小灯，不是一面墙。

**The No-Cold-Gray Rule.** 禁止在浅色背景上使用纯冷灰（`#9CA3AF` 系）。次级文字用 `--ink-soft` / `--muted`。

**The No-Pure-White Rule.** 页面与卡片用 `--card` 或奶油渐变，不用大面积 `#FFFFFF`。

**Legacy Note.** 旧版柔紫 `#6E6AF8` 仅存在于未迁移的 `AppShell` 页面；**新功能一律用 hi-fi 绿系 token**。

---

## 3. Typography

**Font Stack:** 系统原生字体栈，不引入外部网络字体。

**Character:** 单字族，靠字重（400 / 600 / 700 / 800）和字号区分层级。

### Hierarchy（hi-fi）

| 层级 | 规格 | 用途 |
|------|------|------|
| Hero | 26px / 800 | 交流页空态标题、采集页主标题 |
| Title | 17px / 700 | 区块标题、页内 section-title |
| Body | 15px / 1.68 | AI 输出、卡片正文 |
| Small | 13px / 1.55 | 辅助说明、hint-text |
| Label | 12px / 700 | Tab 标签、徽标、section-label |

### Named Rules

**The Breathing Room Rule.** AI 输出段落间距 ≥16px，行高 ≥1.5。焦虑家长应能逐段消化，不是一堵文字墙。

**The No-Tiny-Text Rule.** 面向家长的正文不小于 13px；标签可到 12px，不能再小。

---

## 4. Elevation & Motion

深度感来自 **透明度 + 轻阴影**，不是重投影。

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-card` | `0 14px 36px rgba(31,39,51,0.06)` | 主卡片 |
| `--shadow-soft` | `0 6px 18px rgba(31,39,51,0.05)` | 输入区、浮层 |
| `--shadow-lift` | `0 2px 8px rgba(31,39,51,0.04)` | 按钮微抬 |
| `--ease-out-quart` | `cubic-bezier(0.165,0.84,0.44,1)` | 按钮、Tab 切换 |
| `--focus-ring` | `0 0 0 3px rgba(111,159,86,0.32)` | 键盘焦点 |

**The Float-By-Default Rule.** 默认卡片靠 `--card` + `--line` 区分层级；阴影主要用于交互反馈与弹出层。

**Motion.** 尊重 `prefers-reduced-motion`；流式文字用 rAF 合并更新，不得牺牲正确性换虚假「打字机」。

---

## 5. Layout & Shells

### HiFiMainShell（四 Tab 主站）

- 路由：`/daily` · `/tasks` · `/rehearsal` · `/family-profile`
- 结构：`app-shell`（max 430px 居中）→ `page-stack` → `HiFiBottomNav`
- 组件：`src/components/hifi/HiFiMainShell.tsx`

### HiFiBuildShell（Onboarding · 四模块建档）

- 路由：`/profile/build/*`（小程序：`packageOnboarding`）
- 样式：`app/profile/build/hifi-build.css` · `miniprogram/src/styles/hifi-build.scss`
- 流程：intro → hub → capture → generating → result → basic
- `BuildFlowGuard` / `OnboardingGuard`：未完成 basic 前 Tab 回 hub
- **记忆触点**：`BuildRecordBox` 采集 → `entry_evidence`；`EntrySummaryPage` 展示 `AuthorityInsightCard` + `StructuralTensionCard`（hub 读 digest）

### 视口

- 移动端优先，按 **390×844**（iPhone 13 级）设计
- 触摸目标 ≥ **44px**
- 安全区：`--safe-top` / `--safe-bottom`

---

## 6. Components

> 下列组件均应对齐 [`PRODUCT.md`](PRODUCT.md)「功能 × 记忆 × Agent」表；实现真源见 `docs/contracts/read-contract.md`。

### 底部导航 · HiFiBottomNav

- 4 等宽 Tab：交流 / 任务 / 预演 / 画像
- 选中态：品牌绿文字 + 浅绿胶囊底
- 未解锁 Onboarding 时点击画像等 Tab → 跳转 `/profile/build`

### 输入区 · HiFiInputZone（`input-dock`）

- **默认**：按住说话（`hold-button`），上滑取消
- **可切换**：文字模式（`text-mode` textarea + 发送）
- **录音浮层**：`recording-panel` + 波形 + 「松手发送，上滑取消」
- **实时字幕**：`VoiceHoldLiveBanner`（浅绿通栏，只读 `transcript`，不改 ASR 链）
- 交流页固定在底部；任务/预演各有场景化输入，但交互语言一致
- **记忆**：发送/松手 → 文本进入 `/api/daily/stream` 或预演 analyze → L0 `turn_events`；有价值轮触发 `memory_write`

### 交流线程 · `/daily`

| 元素 | 类名 / 组件 | 说明 | 记忆 |
|------|-------------|------|------|
| 空态引导 | `hero-card` + `suggestion-strip` | 短文案 + 可点 chips | chips 来自 hub `thinkingChips`（有 digest 时） |
| 用户气泡 | `message-row.user` | 右对齐 | 对应 `turn_events` 家长输入 |
| AI 气泡 | `message-row.ai` + `bubble` | 左对齐，主体为 AI 输出 | prose 注入 `retrievalPack` + `deepModelDigest` |
| Thinking | `thinking-bubble` / 四宫格 chips | 首字前占位，不假装已想好 | `dailyPortraitRefresh` 或流式 thinking 事件 |
| Section | `bubble-section` + `section-label` | prose 后的结构化展开 | section skeleton + enrich 读 pack |
| Actions | action 条 | sections 完成后出现，解锁输入 | 来自当轮 LLM actions，可含「今晚可试」入口 |
| 深度展开 | `DailyDeepExpandCard` / understanding-card | hidden section 点开即读 | 同 trace `retrievalPack` |
| 记忆标签 | `memory-label-tag` | 非流式结束后展示 | `memory-status`：`remembered` / `conversation_only` |
| 权威解读 | `AuthorityInsightCard` | 深度 section 气质 | digest 叙事 / 机制人话 |

### 画像 · `/family-profile`

- `soft-card`、`authority-insight-card`（清北学霸 · 家庭智慧背书气质）
- `StructuralTensionCard`：机制张力展示，人话、非诊断标签 ← `structuralTensions`
- Accordion 展开详情；内联账号编辑（非独立 settings 齿轮页）
- **首进**：await `daily-refresh` → 清 tab cache → 拉 hub（「正在整理今日画像」）
- **进度**：`progress-bar` + `progressHint` ← hub completeness / `portraitCards` 实内容
- **二级卡** `PortraitCardDetail`：L2 读 `/api/profile/card/[card]`，展示 digest 切片

### 任务 · `/tasks`

- 状态 pill、来源底边对齐（见 `tasks-ui.css`）
- `task-submit-dock` 反馈区
- **记忆**：任务生成读 `deepModelDigest` + 近期交流；完成反馈可回流 `daily_updates`

### 预演 · `/rehearsal`

- 场景选择 → 输入要说的话 → 分析「孩子会怎么听」
- 检查点 modal、第三块「您可以这样说」
- `SimulationSecondMeBubble` / `AuthorityInsightCard` 结束解读
- **记忆**：`rehearsal/analyze` 强制注入 `childQuotes`、`interactionLoops`、`anchoredFacts`；亲子录音 analyze 仅用转写事实 + digest 语气校准

### Onboarding 组件

| 组件 | 页面 | 设计要点 | 记忆 |
|------|------|----------|------|
| 开始页 | `login` | 仅隐私 +「开始」，无登录墙 | `privacyConsent` 本地标记 |
| intro | `intro` | SecondMe 文案 + tag chips + 边框段落 | 传达建模预期，不写库 |
| hub | `hub` | `entry-row` 四模块 + hero | 读 `buildProgress`；点模块前 `WechatLoginSheet` |
| `WechatLoginSheet` | hub | 登录门；`mergeLocal` 合并本地草稿 | token 后 `buildState` 可同步服务器 |
| `BuildRecordBox` | capture | 按住说话 + status chip + 换题按钮 | → `entry_records` / evidence job |
| generating | generating | 等待链：`mechanismReviewReady` | 后台 synthesis + deep_mechanism |
| result | result | 首版画像 CTA → basic | 读 `built_profile_snapshots` |
| basic | basic | 昵称/年级 | 提交 → `onboardingComplete` |

### Buttons

- **Primary**：`--green-deep` 底 + 白字，高度 ~52px，圆角 `--radius-control`（16px）
- **Secondary**：半透明卡底 + 绿字 + 浅边框
- **Loading**：「正在整理…」+ spinner，disabled 态

### Chips / Pills

- `pill` / `suggestion-strip`：可点击启动语
- 未完成 onboarding 的入口提示 chip
- **禁止**评分、星级、百分比进度

---

## 7. 流式体验（设计侧）

与 [`PRODUCT.md`](PRODUCT.md) 流式原则一致；流式各阶段与记忆写入时序对齐：

1. **thinking 先于 prose**：四宫格让家长知道系统在「读你家孩子」（digest/chips，非假动画）
2. **prose 增量流出**：无重复累加、结束不缩字闪烁；payload 含 `retrievalPack` + `deepModelDigest`
3. **section 紧接 prose**：单次 LLM marker 流，感知为「一段话 + 结构化展开」
4. **actions 后解锁输入**：不必等 hidden/final；此时 L0 已写，L1 job 可能仍在跑
5. **记忆标签在 final 后**：`memory-status` 轮询展示「已记住」——设计上是 prose 的「落款」，不是装饰
6. **可打断**：abort 后保留已展示内容；`turn_event` 仍记录该轮

技术侧：`/api/daily/stream` NDJSON → `dailyStreamClient` → `useStreamBuffer`（rAF 合并 setState）。

---

## 8. 育见新增 UI 白名单

对齐 hi-fi 参考稿时，**禁止因像素对齐而删除**以下实现层能力（详见 `design-reference/README.md`）：

- 交流：流式打断、section 重试、深度展开、`/daily/how-to-speak`、action 条、**memory-label-tag**
- 语音：全屏 `recording-mask`、**VoiceHoldLiveBanner**（只读字幕）
- 预演：4 轮检查点 modal、system hint、**digest 锚定解读卡**
- 任务：反馈顶栏 + `task-submit-dock`
- 画像：accordion、内联账号编辑、**StructuralTensionCard**、**daily-refresh 首屏**
- 采集：`entry-row` hub、`HiFiBuildHero`、`BuildFlowGuard`、**WechatLoginSheet**

---

## 9. Do's and Don'ts

### Do

- **Do** 新页面使用 `HiFiMainShell` / `HiFiBuildShell` 与 `hifi-app.css` token
- **Do** 用布局、占位符、按钮位置引导，少写系统说明
- **Do** AI 输出 15px / 行高 1.68+，段落留白
- **Do** 语音为主入口，文字为可切换辅助
- **Do** 每屏一件事：输入、理解、或决定下一步
- **Do** 对外品牌可用 **育见**；代码中 ChildOS / 心镜 同指本产品
- **Do** 新 AI 展示组件声明其读取的记忆字段（见 read-contract）；无 digest 时用真实「信息不足」态，不填假洞察

### Don't

- **Don't** 恢复紫色 `AppShell` 六 Tab 作为主流程
- **Don't** 嵌套卡片；信息靠间距与标题分层
- **Don't** 冷灰文字、纯白大面积底、测评/打分 UI
- **Don't** 暴露「Agent」「模型」「API」「记忆库」等术语给家长
- **Don't** 学生手搓感：不统一圆角、随意配色、潦草间距
- **Don't** 为了流式「好看」而重复累加或吞掉首字
- **Don't** 在无 `entryFacts`/digest 时假装「深度了解」——UI 可引导补采集或继续交流

---

## 10. Accessibility

- 目标 WCAG 2.1 AA
- 移动端优先；按钮 ≥44px
- 不单独依赖颜色传达状态
- 焦虑场景：字号不过小、密度不过高
- `prefers-reduced-motion` 减少动效
