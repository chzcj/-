# 任务页 / 小程序 UI 迁移复盘（2026-07-18 ～ 07-22）

> **适用范围**：任务 Tab Mock A「柔和内联展开」、预演 confirm/分析页字体、画像/预演系统昵称文案、Web↔小程序 Visual Parity  
> **性质**：约 30 轮对话的问题清单 + 根因 + Agent 反省 + 可执行门禁  
> **读者**：Cursor / Trae / Codex / 人类开发者  
> **配套规则（每轮强制注入）**：`.cursor/rules/miniprogram-ui-interaction-lessons.mdc`

---

## 0. 用户原话弧线（压缩）

| 阶段 | 用户说了什么 | 实际诉求 |
|------|-------------|----------|
| 选型 | 选 Mock A「柔和内联展开」 | 信息架构已定，不是重新设计 |
| 初版验收 | chips 不对、动画怪、场景泄漏、内容薄、**按钮点不了**、标题截断 | **可点 > 像素** |
| 二轮 | 预演字体仍小、confirm 要先看场景摘要、task refine 不稳定 | 读屏层级 + 异步内容契约 |
| 三轮 | daily「保存为任务」别 fancy，要像以前一样立刻「已保存」 | **别擅自升级已验收交互** |
| 四轮 | 分析页小字 +0.5 没打到 quote 行；任务按钮还是点不了 | 改 CSS 要 grep 嵌套 selector |
| 五轮 | 补充项无提交按钮；chevron 太小；「孩子」应改昵称 | 家长 affordance + 个性化系统壳 |

**一句话**：用户要的是 **能点、能懂、像 Web、像说自家孩子**，不是 Agent 自嗨的动效和组件升级。

---

## 1. 问题注册表（按严重度）

### P0 · 功能假死（看起来像 UI，其实是事件/触摸层）

| ID | 现象 | 根因 | 修复 |
|----|------|------|------|
| UI-P0-01 | 任务 chip「做了/有松动」点了无反应 | Taro 3.6 **无 `catchClick`**，handler 从未绑定 | 与 daily pills 一致：`Text` + `onClick` |
| UI-P0-02 | 展开区上半部能点、chip 区不能点 | 卡片 `max-height` + `overflow:hidden` 折叠动画 **吞触摸**（微信端） | **仅在 `is-open` 时条件挂载**反馈面板；去掉 max-height 陷阱 |
| UI-P0-03 | 任务卡点按闪蓝/缩放难看 | `:active` scale + 默认 tap highlight | `hoverClass='none'` + `-webkit-tap-highlight-color: transparent` |

### P1 · 家长看不懂 / 完不成操作

| ID | 现象 | 根因 | 修复 |
|----|------|------|------|
| UI-P1-01 | 补充「孩子反应」填完不知怎提交 | 只有 blur 自动存，无 **主按钮** | 「保存补充」+ toast |
| UI-P1-02 | 不知怎样展开反馈 | 仅 20px chevron，无文案 | **「展开反馈」/「收起」** + chevron 30px |
| UI-P1-03 | 系统文案泛称「孩子」 | 硬编码字符串，未读 onboarding 昵称 | `childSystemCopy(getChildDisplayName())` 单源 |

### P1 · 内容/数据（用户感知为「UI 很空」）

| ID | 现象 | 根因 | 修复 |
|----|------|------|------|
| UI-P1-04 | 任务标题/理由薄、像占位 | refine 异步 + 本地 merge 去重弱 + 缺 `replyExcerpt` fallback | `task-service` await refine、`upsertLocalTask`、GET 触发 refine |
| UI-P1-05 | 同任务两张卡 | `clientId` 与 server `taskId` 当两条 | merge dedup by trace |
| UI-P1-06 | 场景标签泄漏到卡片 | display normalize 未 clamp | `normalizeTaskDisplay` / `coerceTaskSeedTitle` |

### P2 · 像素/字体/跨端

| ID | 现象 | 根因 | 修复 |
|----|------|------|------|
| UI-P2-01 | 预演分析 quote 仍小 | +0.5pt 只改父级，**嵌套 `.da-phase-quote` 未改** | 对实际渲染节点逐条设 `font-size` |
| UI-P2-02 | Web 与小程序任务反馈不一致 | 只改一端 | Web `TaskFeedbackPanel` + `tasks-variant-a.css` 同步 |
| UI-P2-03 | daily「已保存」变宽 pill 很丑 | 擅自改 action UI + `disabled` 等 API | **用户拍板 revert**，只保留 optimistic 状态 |

---

## 2. Agent 反省（必须记住的错误模式）

### 2.1 先接线后验收交互（最大失误）

- 任务反馈 panel 写了完整 JSX，但 **`catchClick` 在 Taro 里不存在** → 用户连点多轮，Agent 仍在调 SCSS/动画。
- **正确顺序**：真机点一遍 → 看 Console 是否进 handler → 再调样式。

### 2.2 用 Web 思维写小程序触摸层

- `max-height` 过渡 + `overflow:hidden` 在 Chrome 看起来正常，**微信 WebView 会吞子元素 touch**。
- **规则**：可交互区不要用「折叠但仍在 DOM 里」的 overflow 陷阱；展开块 **条件挂载** 或 `grid-template-rows: 0fr/1fr` 且实测触摸。

### 2.3 擅自「优化」已验收交互

- 用户要 daily「保存为任务」**立刻**显示「已保存到任务」，Agent 改成 primary 宽 pill + 等 API → 被明确 revert。
- **规则**：用户说「像之前一样」= **只动数据链，不动 pill 形态**。

### 2.4 改字号只改一层

- 「整体 +0.5pt」若未 grep `.da-phase-quote` / `.da-sample-line`，家长看到的 main quote **完全不变**。
- **规则**：字体验收 = 对 **最终 Text 节点 class** 逐项改，不是改容器。

### 2.5 系统壳 vs Agent 内容不分

- 「孩子反应？」是 **系统 UI**，应走昵称；预演里孩子台词是 **Agent 产出**，不能混为一刀切。
- **规则**：`childSystemCopy` 只用于 label/kicker/button；不改 SP/API 里的分析正文。

### 2.6 跨端只改一半

- 任务提交按钮、chevron、昵称文案在 MP 改完，Web 仍旧 → 家长两端体验分裂。
- **规则**：动 `TaskFeedbackPanel` / 任务卡契约 → **MP + Web + contracts 同 PR**。

### 2.7 重代码轻 SP（项目铁律，本轮仍差点再犯）

- 任务内容薄，根因之一是 refine / seed / excerpt 链未与 daily action 对齐；只 beautify 卡片没用。
- 见 `.cursor/rules/sp-content-depth.mdc`：UI 薄 often = 段②读包或段③ SP 不够。

---

## 3. 已验证有效的做法

```
1. Chip 交互：Text + onClick（与 daily pills 同模式），不用 Button/catchClick
2. 展开区：open 时才 mount TaskFeedbackPanel
3. 主操作：补充区必须有「保存补充」类 primary 按钮 + 成功 toast
4. Affordance：chevron 旁必须有「展开反馈」文字（≥12px、品牌绿）
5. 昵称：childSystemCopy(getChildDisplayName()) — 系统 label 单源
6. 任务 enrich：create 时 await refine(≤8s) + GET schedule refine + merge dedup
7. 卡片点击：hoverClass='none'，禁 tap 高亮，禁 :active scale
8. 收工：npm run build:weapp + 真机点 chip/提交/展开 各一次
```

---

## 4. 收工门禁（任务/反馈类 UI）

- [ ] chip / pill 在**真机**可点（不是模拟器 alone）
- [ ] 展开区无 overflow 吞触摸
- [ ] 每条输入路径有**可见提交/保存**按钮
- [ ] 展开 affordance = **文字 + 图标**，不只图标
- [ ] 系统「孩子」→ 昵称（`childSystemCopy`）
- [ ] Web + MP 同改 `packages/contracts` 若文案进 contract
- [ ] `npm run build:weapp` 通过
- [ ] 未擅自改用户说「保持原样」的 daily action UI

---

## 5. 关键文件索引

| 区域 | 文件 |
|------|------|
| 任务反馈 MP | `miniprogram/src/components/tasks/TaskFeedbackPanel.tsx` |
| 任务列表 MP | `miniprogram/src/pages/tasks/index.tsx`, `index.scss` |
| 任务反馈 Web | `src/components/tasks/TaskFeedbackPanel.tsx`, `app/tasks-variant-a.css` |
| 昵称文案 | `packages/contracts/src/child-system-copy.ts` |
| 任务 enrich | `src/lib/server/tasks/task-service.ts`, `miniprogram/src/services/taskStorage.ts` |
| 预演 confirm | `miniprogram/src/pages/rehearsal/index.tsx`, `app/rehearsal/page.tsx` |

---

## 6. 与语音复盘的关系

语音链路有独立复盘：`.agents/postmortems/2026-07-14-voice-asr-outage.md`  
**不要**把「按钮点不了」默认归因网络/域名；本复盘 UI-P0-01/02 才是任务页主因。

---

*最后更新：2026-07-22 · 对应 commit `85955ca` 及此前多轮任务/预演 UI 修复*
