# 育见 · 叙事式组件系统规范（Narrative Component System）

> **目的**：把育见小程序从「按页面各自设计」升级为「按组件拼接」。本文件是组件系统的**单一真源**，先对齐规范、再落地代码。
>
> **地基（不重建，直接复用）**：[`styles/tokens.scss`](../src/styles/tokens.scss) · [`styles/motion.scss`](../src/styles/motion.scss) · [`DESIGN.md`](../../DESIGN.md) · [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md)
>
> **消费的后端契约**：`@yujian/contracts`（`DailySection` / `DailyAction` / `DailyThinkingChip`）、[`lib/portraitCard.ts`](../src/lib/portraitCard.ts)（`PortraitCardContent` / `StructuralTension` / `HubProfileCard`）

---

## 0. 设计哲学

育见是**文字密集型 AI 产品**。用户在读一份「专业、可信、层次清晰的分析报告」，不是刷信息流、不是填表单。

四条不可动摇的原则：

1. **组件优先（Component First）**：页面 = 组件的组合。同一组件跨业务复用；新功能优先拼接已有组件，不重造视觉风格。
2. **拆分层级，拒绝文字墙**：长文本用标题 / 摘要 / 引用 / 重点 / 卡片 / 折叠 / 标签切成阅读单元。禁止「一整段连续排版」。
3. **克制、专业、温暖、现代**：无过度装饰、无复杂渐变、无夸张动画。动画服务阅读节奏（渐入、展开、数字递增），非炫技。
4. **贴合后端字段**：组件是字段的容器。字段有多长、分几类，组件就长成什么样；需要时**同步调整 Agent 输出**（见 [[ui-modification-workflow]]），不孤立改 UI。

---

## 1. 统一外壳（NarrativeCard）— 一致性的根本

**所有叙事组件共享同一个卡片外壳**，靠「语义色 + 图标 + 眉标」区分类型，而非各画各的。这是「不同页面组合后依然一致」的机制。

```
┌─ NarrativeCard ─────────────────────────┐
│  ▸ [icon]  EYEBROW 眉标（语义色/12·700）  │   ← 可选
│  标题 Title（17·700 ink）                 │   ← 可选
│  ─────────────────────────────────────   │
│  正文 / 列表 / 引用 / 折叠…（body slot）   │
│  ─────────────────────────────────────   │
│  footnote 脚注（13 muted）                │   ← 可选
└──────────────────────────────────────────┘
```

**外壳统一参数（全部来自 token，不新增数值）：**

| 维度 | 值 | token |
|---|---|---|
| 背景 | 奶油纸感 | `$card` |
| 圆角 | 24px | `$radius-card` |
| 边框 | 1px 细线 | `$line` |
| 内边距 | 16px（`lg` 卡 22px） | `$spacing-md` / `$spacing-lg` |
| 阴影 | 默认无，靠 card+line 分层 | 交互/浮层才用 `$shadow-*` |
| 卡间距 | 16px | `$spacing-md` |
| 进场 | `page-rise` / `section-reveal` | `motion.scss`（已有） |

**语义色板（复用 token，一个组件一个 accent，眉标/图标/左饰条取此色）：**

| 语义 | accent | 用于 |
|---|---|---|
| 中性叙述 | `$ink` / `$muted` | Summary · Section · Timeline |
| 洞察/正向 | `$green-deep` | Insight · Highlight · Suggestion · Metric · Action |
| 引用原声 | `$butter`（暖黄） | Quote |
| 风险/张力 | `$warning` `#d98b2b`（弱） / `$danger` 仅强警示 | Risk |
| 画像 | `$green` + 进度 | Profile |

> **The One Voice Rule**（沿用 DESIGN.md）：品牌绿单屏占比 ≤10%。accent 是点睛，不铺满。

---

## 2. 组件目录（15 个）

组件落地路径统一为 `src/components/narrative/`，导出于 `narrative/index.tsx`。下表每个组件标注：**消费字段 → 结构 → 现有实现（迁移来源）**。

### 2.1 结构类

| 组件 | 消费字段 | 结构 | 现有实现 → 动作 |
|---|---|---|---|
| **Section** 信息分组 | `DailySection{label,kind,paragraphs,items,quotes,note}` · `PortraitCardSection{heading,items}` | 眉标 + body（段/列/引混排）+ 脚注 | `daily/DailySectionView` → **抽象为通用 Section** |
| **Accordion** 可折叠 | 任意（title + 折叠 body） | 标题行（含展开箭头）+ 展开区 | `daily/DailyDeepExpandCard` → 收敛 |
| **Guide** 引导卡片 | 静态文案 + 可选 CTA | 图标 + 标题 + 短说明 + 按钮/chip | `hero-card` / intro 段 → 抽象 |

### 2.2 观点/分析类

| 组件 | 消费字段 | 结构 | 现有实现 → 动作 |
|---|---|---|---|
| **Summary** 摘要 | `PortraitCardContent.summary`（≤56字，见 `truncateSummary`）· `lead` | 无外壳/轻外壳的领读段，字重略高、颜色略深 | `lib/portraitCard` 逻辑 → 组件化 |
| **Highlight** 核心观点 | 单句/短段（Agent 需产出「一句话观点」字段，见 §5） | 左饰条 + 加重短句，绿 accent | **新建**（后端补字段） |
| **Insight** 深度分析 | `DailySection`（`diagnosis_headline`/`this_time`/`profile_reading`）· digest 叙事 | 权威气质卡：眉标 + 多段正文 | `hifi/AuthorityInsightCard` → 纳入体系、统一外壳 |
| **Risk** 风险提示 | `StructuralTension{title,detail,confidence}` | 橙/弱红 accent + 图标 + 标题 + detail；**非诊断标签、非打分** | `hifi/StructuralTensionCard` → 语义归位为 Risk |
| **Suggestion** AI 建议 | 预演「您可以这样说」· 沟通建议段 | 绿 accent + 「可以这样说」引导 + 建议正文 | 预演第三块 → 抽象 |

### 2.3 数据/关系类

| 组件 | 消费字段 | 结构 | 现有实现 → 动作 |
|---|---|---|---|
| **Metric** 数据指标 | `HubProfileCard.progress` + `progressHint` | 数字/进度 + 标签；**禁止百分比打分暗示**，仅「收集度/整理进度」 | `progress-bar` → 组件化（数字递增动画） |
| **Comparison** 对比分析 | 「孩子会怎么听 vs 你想表达」等成对字段 | 左右/上下两栏对照 | **新建**（后端补成对字段） |
| **Timeline** 时间轴 | `profile/trajectory` 轨迹项 | 竖向节点 + 时间 + 事件摘要 | `profile/trajectory` 页 → 抽象 |
| **Profile** 画像卡 | `HubProfileCard{title,body,progress,progressHint}` · `DailyPortraitCards` | 标题 + 摘要 body + 进度 + 「上次整理」 | 画像 Tab 卡 → 组件化 |

### 2.4 原子类（升级现有 `ui/`）

| 组件 | 消费字段 | 现有 → 动作 |
|---|---|---|
| **Quote** 引用原文 | `DailySection.quotes[]` · digest `childQuotes` | `.quote-line`「」→ 暖黄卡组件 |
| **Tag** 标签关键词 | `DailyThinkingChip{label,text}` · 关键词数组 | `ui/Tag` → 扩语义变体（可点/只读/进行中） |
| **Action** 行动计划 | `DailyAction{label,kind,primary,payload}` | action 条 → 组件化（primary/secondary） |

---

## 3. 阅读单元拼装范式

长文本页面按此顺序拼装（自上而下、逐段可消化）：

```
Guide/Summary（我在读什么）
  → Highlight（一句话抓住重点）
  → Insight × N（展开分析，段间距 ≥16px）
  → Quote（孩子原声佐证）
  → Risk（张力提示，克制）
  → Suggestion / Action（下一步怎么做）
  → Accordion（想更深再点开）
```

**交流页流式**沿用既有时序（`DESIGN.md §7`）：thinking → prose → Section 卡 → Action，组件替换视觉皮不改时序。

---

## 4. 图标系统（当前 gap）

现状：`components/hifi/icons/` 只有 `TabIcons`。叙事组件需要一套**线性语义图标**（Insight 灯泡 / Risk 三角 / Suggestion 对话 / Quote 引号 / Timeline 节点 / Metric 刻度等）。

规范：单色线性、`stroke` 取组件 accent 色、`1.6px` 线宽、`20×20` 视框、与文字基线对齐。落地时新增 `narrative/icons/NarrativeIcons.tsx`。

---

## 5. 需同步调整的 Agent 输出（情况 3）

以下组件依赖后端**新增/规整字段**，落地时须同步改 `prompts/` 与 BFF（不孤立改 UI）：

| 组件 | 需要的字段 | 现状 |
|---|---|---|
| Highlight | 每段分析的「一句话核心观点」 | 现无独立字段，需 Agent 产出 |
| Comparison | 成对字段（如 `youMeant` / `childHears`） | 现为散文，需结构化 |
| Section 层级 | 稳定的 `label` + `kind` 语义约定 | 已有 `kind`，需固化 id↔语义映射 |

> 改这些前，先读懂对应模块输出（`prompts/core/*`、`src/lib/server/daily/*`），确认字数与结构，再 UI/prompt 一起改。

---

## 6. 落地路线（规范通过后）

1. **P0**：建 `narrative/` 外壳 `NarrativeCard` + 语义色/图标基座 + `index.tsx` 导出。
2. **P1**：迁移已有实现（Section / Insight / Risk / Accordion / Quote / Tag / Action）——纯收敛，不改逻辑。
3. **P2**：新建缺口（Highlight / Metric / Comparison / Timeline / Guide / Summary / Profile）。
4. **P3**：逐页用组件重组（画像页信息最密，建议首个试验田），同步 Agent 输出。

每步产出后对照 [`visual-diff.md`](./visual-diff.md) 自检，不因像素对齐删除 [`DESIGN.md §8`](../../DESIGN.md) 白名单能力。

---

## 7. Do / Don't

**Do**：所有叙事卡走 `NarrativeCard` 外壳 · 语义靠 accent+图标+眉标 · 段间距 ≥16px 行高 ≥1.68 · 无 digest 时用真实「信息不足」态。

**Don't**：嵌套卡片 · 冷灰文字 · 纯白大底 · 评分/星级/百分比进度 · 暴露「Agent/模型/记忆库」术语 · 为流式好看而重复累加或吞首字 · 给单页造一次性视觉风格。
