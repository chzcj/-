# Product

## Register

product

## Users

焦虑但有反思能力的家长，通常是孩子的父母。他们同时承担着两个角色：一是日常管教者（催促作业、管理手机、沟通学习），二是真正想理解孩子的观察者。

他们使用产品时的典型场景：
- 在手机上快速记录或说出一个真实的家庭片段，不需要组织成"专业描述"
- 期望获得比通用 AI（如豆包、DeepSeek）更具体、更深入的孩子理解，而不是泛泛的教育建议
- 在沟通前预演自己要说的话，看看孩子可能会怎么听
- 长期积累孩子的行为片段，形成越来越准确的孩子画像

核心任务（按优先级）：
1. 获得比通用 AI 更深的孩子理解（拆开表面行为，看到家庭机制链）
2. 促进亲子关系（从对抗走向理解，从"管教"走向"看见"）
3. 帮助孩子提高成绩（此方向 product design 尚未完成，当前 product 不直接表达这一目标）

## Product Purpose

ChildOS（心镜）是一个帮助家长理解青春期孩子的 AI 产品。

它不做的事：直接给教育建议、给家长评分、给简单结论。

它做的事：通过多入口信息采集和结构化追问，把家长描述的家庭片段转化为更深的孩子理解——解释孩子行为在这个家庭里的功能、指出家长可能长期看不见的家庭机制、把多个片段串成证据链。

最终目标是让家长产生"这个系统真的懂我家孩子"的感觉，并且形成"越用越懂孩子"的产品闭环。

## 培优型定位（深度建模）

育见服务的是**想更好支持孩子成长**的家庭，而不是只做危机干预或「拯救」已经严重恶化的亲子关系。语气强调：看见优势、搭建习惯、亲子协作、可验证的小步尝试——不是病理化、不是贴标签、不是给家长打分。

产品内核是【深度建模】：家长持续输入真实生活片段 → 多 Agent 共建孩子 SecondMe → 前台所有分析必须锚定家庭事实与机制闭环。详见 `docs/product/deep-modeling.md`。

**一句话闭环**：家长说的每一句具体话，都会进入记忆；记忆经后台 Agent 提炼为「你家孩子」模型；四 Tab 的每一次 AI 输出，都必须从记忆里找证据，而不是泛泛聊天。

---

## 深度了解孩子：记忆中心架构

育见不是「聊完就忘」的对话产品，而是**以记忆为真源**的家庭理解系统。家长输入是原材料；记忆层是仓库；Agent 是加工线；四 Tab 是展示窗。

### 家长输入 → 记忆 → 理解 → 行动

```
家长原话/片段（语音或文字）
    ↓
L0 turn_events（每轮必记，含 traceId）
    ↓ gate：safety / insufficient / 短寒暄 可跳过长期写入
L1 daily_updates + memory_write job
    ↓
entry_evidence（四模块）/ episode_ingest（高价值反证）
    ↓
evidence_networks · conditional_profiles · family_interaction_cycles
    ↓ deep_mechanism_review（多 Agent 链）
deep_model_digest（家长向 SecondMe 摘要）
    ↓
前台 Agent 读 digest + retrievalPack → 交流 / 预演 / 任务 / 画像
```

契约真源：`docs/contracts/memory-read.md` · `docs/contracts/memory-write.md` · `docs/contracts/read-contract.md`。

**技术架构图**（前后端 Agent 工作流、SP 分层、Job 链）：[`docs/architecture/agent-memory-workflow.md`](docs/architecture/agent-memory-workflow.md)

### 两个记忆原则（产品铁律）

1. **具体事实优先**：场景、原话、触发点越具体，模型越准；系统不嫌弃「乱说」，但会引导家长多说细节（四模块软引导 ≥800 字/模块）。
2. **前台只读、后台思考**：家长可见 AI（交流 prose/section、预演分析）只读 `retrievalPack` + `deepModelDigest`，引用已验证事实与机制名；深度推理由后台 Agent 完成并写回记忆，避免「每轮重新猜孩子」。

### 前台输出门控（SP 强制）

所有家长可见分析须满足（见 `docs/product/deep-modeling.md` §7）：

- 先读 `deepModelDigest`；无则读 `retrievalPack` 并明示信息不足
- 至少 **1 条** `entryFacts` / `anchoredFacts`（锚定事实）
- 至少 **1 句** 机制闭环（家长动作 → 孩子反应 → 可能在保护什么）
- 培优语气：成长加速器，非危机拯救、非诊断标签

---

## 功能 × 记忆 × Agent 对照

| 功能 / 路由 | 家长做什么 | 写入记忆 | 读取记忆 | 主要 Agent / Prompt |
|-------------|-----------|----------|----------|---------------------|
| **Onboarding · intro/hub** | 了解 SecondMe，选四模块 | — | — | 纯 UI；文案传达「共建成长模型」 |
| **Onboarding · capture** | 模块内语音/文字采集 | `entry_records` → `entry_evidence` job | 模块 SP + 已有 stage summary | `entry*FollowUp` / `entry*Summary` · `entryEvidenceBuilder` |
| **Onboarding · generating/result** | 等待/阅读首版画像 | `built_profile_snapshots` · 链式 `deep_mechanism_review` | 四模块 evidence | `profileBuildSynthesis` · `profileBuildDiagnosis` · `deepMechanismReview` 链 |
| **Onboarding · basic** | 填昵称/年级 | `onboardingComplete` 门禁 | 已有 snapshot | — |
| **交流 `/daily`** | 说真实片段 | L0 每轮；L1 按 gate；`memory_write` | `deepModelDigest` + `retrievalPack`（10 键） | `dailyDialogueOrchestration` · section enrich · `memoryWrite` |
| **交流 · 深度展开** | 点开 hidden section | — | 同轮 retrieval + digest | `section-llm-enrich`（SecondMe 结构解释） |
| **交流 · 记忆标签** | 看「已记住」提示 | — | `GET /api/daily/memory-status?traceId` | 展示 `memory_write` / `episode_ingest` 结果 |
| **任务 `/tasks`** | 认领/反馈小步尝试 | 任务完成 → `daily_updates` 可回流 | `deepModelDigest` + 近期 observations | `familyPlanner` · `planning` API |
| **预演 `/rehearsal`** | 模拟「孩子会怎么听」 | 预演轮次可记 turn | **必读** digest：`childQuotes` · `interactionLoops` · `anchoredFacts` | `communicationRehearsal` · `rehearsal/analyze` |
| **预演 · 亲子录音** | 整段对话转写分析 | 转写文本可入 episode | digest 仅作背景校准，**禁止**把未出现内容写入分析 | `dialogue-transcribe` + analyze |
| **画像 `/family-profile`** | 看 SecondMe、补采集 | 登录 `daily-refresh`；补模块 → 再跑 evidence/digest | `portraitCards` · `hub` · `structuralTensions` | `dailyPortraitRefresh` · `deepModelDigestBuilder` · `profile_rewrite`（2 天桶） |
| **画像 · 二级卡** | 展开成长/行为/互动等 | — | `built` + hub 字段 | `AuthorityInsightCard` 展示 digest 叙事 |
| **登录刷新** | 再次打开 App | 链式 digest / model_review | 全量记忆 → 人话 chips | `daily-refresh-agent` |

### 后台 Agent 分工（写记忆）

| Agent | 时机 | 读 | 写 |
|-------|------|----|----|
| `entry_evidence` | 每模块完成 | rawText | `entry_evidence_packs` |
| `profileBuildSynthesis` | 四模块齐 | stage summaries | 证据网络草案 |
| `profileBuildDiagnosis` | 综合后 | synthesis handoff | `coreJudgment`、机制链草案 |
| `deep_mechanism_review` | 建模完成 + 日桶 | 全量记忆层 | `evidence_networks`、假设、叙事、`structuralTensions` |
| `deepModelDigestBuilder` | deep 后 + 日刷新 | 机制+画像+循环 | `deep_model_digest` |
| `memory_write` | 交流有价值轮 | 当轮分解 | `daily_updates`、叙事模式等 |
| `digest_update` / `model_review` | 日桶链式 | 记忆全量 | brief/board、假设复核 |
| `profile_rewrite` | 登录且画像 >2 天 | 旧 snapshot + evidence | 整体重写画像字段 |
| `dailyPortraitRefresh` | 进 daily/profile | digest + 近期输入 | `thinkingChips`、`portraitCards` |

多 Agent 链细节：`ecosystemClassifier` → `theoryMatcher` → `mechanismSynthesizer` → `structuralRiskExtractor`（`deep_mechanism_review` 内）。

### 家长可见 vs 系统内部

| 家长看到 | 来自记忆字段 | 家长看不到 |
|----------|-------------|-----------|
| 交流 prose + section 卡片 | `entryFacts`、`matchedMechanisms`、`deepModelDigest` | 16 理论卡名、机制矩阵 JSON |
| thinking 四宫格 | `dailyPortraitRefresh` → `thinkingChips` | Agent 名称、置信度分数 |
| 「已记住 / 先记在对话里」 | `memory-status` per traceId | job 队列详情 |
| 画像卡 + 进度条 | `portraitCards`、hub completeness | 原始 evidence pack |
| 家庭运转张力 | `structuralTensions` in digest | 心理诊断标签 |
| 预演「孩子会怎么听」 | `childQuotes` + `interactionLoops` | 无画像时的空泛模拟 |

---

## 当前主链路（hi-fi）

线上主体验以 **四 Tab** 组织（`HiFiMainShell`），不是旧版 `/home` 问题梳理流：

| Tab | 路由 | 价值 |
|-----|------|------|
| 交流 | `/daily` | 家长说真实片段 → AI 深度理解（非泛建议） |
| 任务 | `/tasks` | 从交流中沉淀可验证的小步尝试 |
| 预演 | `/rehearsal` | 选场景后预演「孩子会怎么听」 |
| 画像 | `/family-profile` | 长期 SecondMe：摘要卡、机制链、本周回顾 |

**Onboarding 门禁（小程序 · 体验优先）**：陌生用户 **不强制首屏登录**；须完成四模块建档与画像生成，并在结果后填写孩子昵称/年级，才解锁四 Tab。

```
开始（隐私勾选）→ intro（SecondMe 介绍）→ hub（四模块入口）
  → 点模块前：微信登录（WechatLoginSheet）
  → capture（采集）→ generating → result → basic（昵称/年级）→ 四 Tab
```

Web 同源逻辑：`/login` → `/profile/build/*`；`onboardingComplete` 在 **basic 提交且已有画像** 时置位（非 built POST 时）。旧路由由 middleware 重定向到 `/daily`，不恢复紫色心镜布局。

**交流单轮输出形态**（BFF 流式，契约见 `docs/contracts/daily-stream-events.md`）：

```
start → thinking（四宫格）→ prose 流式 → prose_complete
  → section_start/delta/complete（≤3 个可见 section）→ sections_complete → actions → final
```

hidden section 后台预取，供「深度展开」点开即读，不阻塞前台。深度展开 Agent 读同轮 `retrievalPack`，把机制放回「你们家的结构里」。

### 越用越懂：产品闭环指标

家长应能感知到：

1. **被记住**：交流后出现「已记住」或「这次先记在对话里」（`memory-status`）
2. **有证据**：AI 引用具体场景/原话，而非「很多孩子都会…」
3. **画像在变**：画像 Tab 显示「上次整理」时间；补采集后 completeness 上升
4. **预演更贴**：说过几轮后，预演开始引用孩子原话与家庭互动循环
5. **任务可验证**：任务来自交流中的机制洞察，反馈后回流记忆

最怕退化成的形态见 `docs/product/deep-modeling.md` §8：流水账、鸡汤、育儿百科、空泛 AI、心理测评。

## 流式体验原则

1. **首字前**：允许 thinking 四宫格占位（家长知道系统在「读你家孩子」），不假装已经想好。
2. **正文**：增量流式、无短语重复累加、结束时不缩字闪烁；节奏可略平滑，但不得牺牲正确性。
3. **section**：prose 结束后紧接流出（单次 LLM 调用 marker 流），家长感知为「一段话接结构化展开」。
4. **actions**：visible sections 全部落定后再出，解锁输入框；不必等 hidden/final 才允许发下一条。
5. **打断**：家长可 abort；已展示内容保留，标记 interrupted。

品牌对外可用 **育见**；代码与文档中 ChildOS / 心镜 为同一产品。视觉与交互规范见 [`DESIGN.md`](DESIGN.md)。

## Brand Personality

三个词：简洁、清晰、沉浸。

- **简洁**：页面没有多余的装饰、卡片堆叠或系统文案。每个视觉元素都有存在的理由。
- **清晰**：用户不需要读说明就知道下一步该点哪里。通过按钮、输入框占位提示、入口排列自然引导操作。
- **沉浸**：AI 输出是页面主体，系统 UI 退后，让家长专注于内容而非操作工具。

面向的不是"想学育儿技巧"的家长，而是"我已经很努力了，但想真的理解孩子"的家长。产品语气是温柔、可信、不急着建议的。

## Anti-references

这个产品绝不该看起来或感觉像：
- **机械的 AI 系统**：不能像 ChatGPT 那样"什么都能聊"的通用对话感，不能有冰冷的技术感
- **学生团队手搓的简陋设计**：不能有视觉廉价感、比例失调、风格不统一的粗糙痕迹
- **心理测评工具**：不能有任何评分、分级、对比、诊断的暗示，不给家长压力感
- **后台管理系统或问卷系统**：不能冷冰冰、机械，不能像填表
- **普通育儿建议产品**：不能堆砌"多鼓励、少批评、制定计划"这类泛建议

## Design Principles

1. **UI 引导 > 文字说明**：用布局、按钮、入口设计自然引导操作，而非大段解释文字。新用户应能在 10 秒内明白下一步该做什么。
2. **沉浸而非干扰**：AI 输出是页面主体。系统标题、装饰、固定文案退后；页面像一面镜子，而不是一个工具台。
3. **不评判、不压迫**：界面不给家长任何评分、分级、对错、达标/未达标的暗示。追问是为了理解孩子，不是为了考核家长。
4. **克制且专业**：不花哨、不廉价。每个视觉元素都有存在理由。主视觉为 hi-fi 黄绿系（见 DESIGN.md 的 token 定义；旧版柔紫 #6E6AF8 已废弃），大面积留白和浅色背景让内容呼吸。
5. **低门槛输入**：语音优先，短输入友好。占位文案让家长感觉"我直接说发生了什么就行"，而不是"我要组织一段专业描述"。

## Accessibility & Inclusion

- 目标 WCAG 2.1 AA 级别
- 移动端优先（家长主要使用场景是手机）
- 支持语音输入，降低文字组织门槛
- 界面不依赖颜色作为唯一的信息传达方式
- 关注焦虑状态下的阅读体验：字号不应过小、信息密度不应过高、操作按钮应足够大且好点
- 减少动效，避免过度刺激；支持 `prefers-reduced-motion`
