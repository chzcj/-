# 高保真界面迁移 Playbook（持久资料）

> **用途**：任何「高保真 HTML / mock → Web TSX / 小程序 Taro」迁移任务开工前必读。  
> **强制注入**：Cursor 规则 [`.cursor/rules/hifi-ui-migration.mdc`](../../.cursor/rules/hifi-ui-migration.mdc)（与 [`ai-product-engineering.mdc`](../../.cursor/rules/ai-product-engineering.mdc) 联动）。  
> **实例**：本文 §9 画像页「成长手账」为首个完整样例。

---

## 1. 何时启用本 Playbook

满足 **任一** 即全文生效：

- 用户提供或引用 `design-reference/*.html`、改版稿、390px mock
- 任务含「迁移高保真 / PORTING / 改版稿 / mock 对齐」
- 改 UI 且展示字段来自 Agent/BFF/Job（非纯 SCSS）

**不启用**：仅改颜色、间距、导航，不动 API 字段与 Agent 链。

---

## 2. 禁止顺序（P0）

1. 先改 TSX/SCSS，后补 Agent 字段  
2. Phase B 用 hardcode 假 AI 文案（允许 skeleton、静态空态、产品兜底句）  
3. 只改样式导致截断，不改结构 / SP / consumer 字段  
4. 未实现 `gatherXxxContext` 就写新 SP  
5. 把新区块文案塞进已有 Agent（职责膨胀 + 空转）  
6. 降低刷新频率（如画像改 24h 一次、手账仅 weekly cron）  
7. 字段无 producer 或无 consumer 上线  

---

## 3. 迁移六步法

```mermaid
flowchart LR
  A[1 资产入库] --> B[2 链路画布]
  B --> C[3 L1/L2/L3 映射]
  C --> D[4 记忆生产反推]
  D --> E[5 UI壳→读包→SP]
  E --> F[6 验收与结论句]
```

| Step | 内容 | 产出物 |
|------|------|--------|
| 1 | HTML → `design-reference/`；拆组件；摘录 **视力锚点文案** | 组件表 + mock 原文 |
| 2 | 用户动作、同步/异步路径、Agent 落点、UI 状态机 | 5 行画布（HANDOFF） |
| 3 | 每槽位 L1/L2/L3 对应 **哪个 JSON 字段** | trace 表 |
| 4 | memory_write/Job 谁生产；读包够不够；缺则补写入 | `gatherXxxContext` 类型 |
| 5 | B UI 壳 → C 读包+BFF → **再** SP+Job → D 接线 | types/route/Job |
| 6 | L1–L4、audit:fullchain、390px 并排 | 一行结论 |

---

## 4. 三级界面（L1 / L2 / L3）

### 4.1 定义

| 层级 | 典型 UI | 文案长度 | 常见字段 |
|------|---------|----------|----------|
| **L1** | Tab 首屏、tile、hero 一行 | 短；多 clamp | `summary`、`teaser`、计数 |
| **L2** | Sheet 列表、insight 汇总 | 中 | 常是 **`lead`**，不是 summary |
| **L3** | 详情、记忆、胶囊 | 长；可 scroll | `lead` + `sections` / 原文 / AI 轻解读 |

**铁律**：同一张卡 L1/L2/L3 **字数与文风不同**，不能一个字段打三层。

### 4.2 UI + Agent 同工（模式 C）

- mock 装不下 → 改 UI **或** 改 SP 切分/字数上限  
- L3 mock 只画 lead 时：首屏 lead 对齐 mock，**sections 折叠在下方**（不删 SP 信息密度要求）  
- badge / label / eyebrow / progressHint → **Static**，不进 Agent  

### 4.3 截断与 SP 对齐

| 组件类型 | 前端 | SP/代码 |
|----------|------|---------|
| 固定标题 | ellipsis / line-clamp | 字数上限写进 SP |
| 可 scroll 详情 | 不 clamp lead/sections | SP 规定 lead/sections 字数下限 |
| 计数 | tabular-nums | 规则聚合，非 LLM |

---

## 5. Agent 三档 + 勿合并

| 档位 | 判定 | 动作 |
|------|------|------|
| **继承** | 字段、SP、Job 不变 | 只增 consumer |
| **微调** | 同 Agent，新 UI 位或加厚 SP / 扩展 input | gatherContext + Worked Examples |
| **重建** | 新 schema、新周期、mock 新块 | 新 SP + layer + Job + BFF |

**勿合并典型案例**：

- 手账三行 ≠ `weeklyReview` 五字段 → 独立 `weeklyHandbookSynthesizer`  
- 手账 heroCopy ≠ `dailyPortraitRefresh` → 独立字段  
- 读包代码可 **shared helper**，SP **不可** 合并  

---

## 6. 全链路契约（与 ai-product-engineering 一致）

### 6.1 每字段六问

| 字段 | Producer | 形态/约束 | Storage | Consumer | UI 可见 | 判定 |

### 6.2 空转定义

1. **写空转**：写了无人读  
2. **读空转**：读了不影响 UI/路由/持久化  
3. **展示空转**：UI 有坑位，Agent 长期不产出  

### 6.3 四层对齐

L1 产品语义 → L2 contracts/types → L3 BFF/Job/SP → L4 Web + MP 解析  

---

## 7. 记忆：生产 → 读包 → SP（反推）

### 7.1 生产链（育见现状）

```
家长动作
  → turn_events（每轮）
  → L1 gate（非 insufficient/寒暄）
  → daily_updates + memory_write + episode_ingest
  → digest_update / model_review / dossier_patch / deep_mechanism_review
  → deep_model_digest / dossier / built / trajectory / daily_ui_snapshot
```

**executeWritePlan 落库且下游会读**：daily_updates、evidence_networks、pending_hypotheses、family_interaction_cycles、parent_narrative_patterns、episodes/atoms、entry_evidence、built_profile_snapshots。

**L1 未过 gate**：仅有 turn_events——手账可展示，但勿写「已写入长期记忆」除非 feed 标 material。

### 7.2 读包先于 SP

每个新展示 Agent 必须先有 **段② 读包**：

```typescript
type XxxReadPack = {
  // 业务字段…
  materialThreshold: { met: boolean; reason: string }
  previousSnapshot: ... | null  // 对比型输出必需
}
```

**materialThreshold 示例**：本周 feed ≥ 2 **或** 有效 L1 轮 ≥ 3 → 才跑 LLM；否则 no-op + UI 空态。

### 7.3 输入不足时的写入补洞

| 若 mock 需要 | 现生产 | 补洞 |
|--------------|--------|------|
| 家长随笔 | daily_updates 可存但无类型 | `POST /api/profile/journal` + `sourceKind:journal` |
| 结构化闪光点 | highlights: string[] | 升级 `HighlightMoment[]` |
| 语音秒级标注 | turn 全文 | v1 句级；v2 rehearsal 分段 |
| 周界材料 | 无 weekKey 过滤 | `gatherWeekMemoryContext(weekKey)` |
| 对比上次 | 无历史 snapshot | 持久化 week handbook snapshot |

**原则**：不新建「手账写入 Agent」——写入仍走 memory_write；手账是 **读侧聚合 + 展示 Agent**。

### 7.4 SP 反推表模板

```markdown
## AgentName

### mock 输出锚点
- fieldA ← 「mock 原句…」

### input JSON（段②）
| 字段 | gather 函数 | 下限 |

### no-op
- 条件 / 保留上周 snapshot

### 刷新
- 触发 / contentHash skip

### Worked Examples
- 贴 mock 原文
```

### 7.5 刷新频率（与旧页对齐）

- **同步**：保留旧链（如 `POST daily-refresh` → `dailyPortraitRefresh`）  
- **异步**：新 Job 挂同一触发点；同周期 contentHash 可 skip LLM  
- **禁止**：仅 cron、24h skip、减少进 Tab 刷新  

---

## 8. BFF / Web / MP

- 新功能优先 **增量 BFF**（如 `handbook-pack`），避免污染 hub 致旧 consumer 断裂  
- MP：Sheet → 分包 page；390px → rpx；不写假 status bar  
- Web：Phase 可在 MP 验收后  
- 语音：只读已有资产；不改 ASR 锁定文件  
- SP 深度：后台 ≥ `deepMechanismReview`；前台展示 ≥ `dailyPortraitRefresh`  

---

## 9. 实例：画像页「成长手账」

> 真源 mock：`design-reference/profile-portrait-preview.html`（待拷入）

### 9.1 组件 → 层级

| 区块 | L1 | L2 | L3 |
|------|----|----|-----|
| memory-hero | heroCopy, 页数, 三统计 | — | sheet-pages |
| portrait-tile ×7 | summary cap | insight: **lead** | card: lead + sections |
| handbook | headline + 三行 | sheet-handbook 全文 | — |
| years-ago | teaser | — | then/now 长段 |
| memory | — | mem 列表 | voice/diary/shine/hard |

### 9.2 Agent 判定摘要

| 能力 | 档位 |
|------|------|
| portraitCards / dailyPortraitRefresh | 继承 + SP 微调（L1/L2/L3 + HighlightMoment） |
| weeklyReview | 勿动、勿合并 |
| weeklyHandbook / memoryFeed / timeCapsule / memoryMomentLight | 重建 |
| POST daily-refresh 频率 | 继承（每进 Tab） |

### 9.3 mock 视力 → 字段（节选）

| mock | 字段 | Agent |
|------|------|-------|
| 「不是懒，是需要自己的节奏感…」 | L1 summary | dailyPortraitRefresh |
| insight ic-body 长段 | L2 lead | 同 Agent，consumer 改 |
| 「从被催到自己开第一步」 | headline | weeklyHandbook |
| 「本周自己开工出现 2 次…」 | highlight | weeklyHandbook |
| 「38 秒升级点」 | relationMoment | weeklyHandbook（输入含 feed/quotes） |
| voice AI 轻解读 | interpretation | memoryMomentLight |

### 9.4 首个实例的 trace 表

见 `docs/contracts/handbook-pack-trace.md`（实施时创建）。

---

## 10. 收工清单

- [ ] design-reference 有 HTML + L1/L2/L3 表  
- [ ] trace 表 + SP 反推表  
- [ ] gatherXxx 先于 SP  
- [ ] Phase B 无假 AI  
- [ ] 刷新频率 ≥ 旧页  
- [ ] `npm run audit:fullchain`  
- [ ] HANDOFF 结论句  
- [ ] 更新 `CONTRACT-ALIGNMENT-AUDIT.md`（若改契约）  

---

## 11. 文档映射

| 本文 | 仓库 |
|------|------|
| 全链路六问/空转 | `.cursor/rules/ai-product-engineering.mdc` |
| 收工 7 步 | `.cursor/rules/fullchain-contract-check.mdc` |
| 读包真源 | `docs/contracts/read-contract.md` |
| BFF 三段 | `.trae/documents/bff-three-phase-overview.md` |
| 小程序移植 | `miniprogram/docs/PORTING.md` |
| SP 深度 | `.cursor/rules/sp-content-depth.mdc` |
| 大任务分卷回看 | `.cursor/rules/big-task-recheck.mdc` |

---

## 12. 分卷纪律（强制）

大任务禁止一口气做完。每卷：

1. 重读用户最近 10–20 条反馈  
2. HANDOFF 写「只改 / 不改」  
3. 小改后对照验收勾选，再开下一卷  

详见 `.cursor/rules/big-task-recheck.mdc`。

---

## 13. 小程序平台硬约束（期望校准）

用户感受到的「滞涩、不灵动、画面模糊」，**动效和分辨率只是表层**；本质是小程序寄生架构与原生 APP 的机制差距：

| 机制 | 影响 | 迁移应对 |
|------|------|----------|
| 逻辑层 + 渲染层双线程 + 桥 | 点击/滑动有跨线程延迟 | 减少 setData 频率；合并更新；忌高频逐帧写 |
| WebView 渲染（多数仍非 Skyline） | 复杂过渡易掉帧 | 动效克制；优先 CSS transition；不硬刚 60fps APP 感 |
| 主包 ≤2MB / 总包 ≤20MB | 无法全量预置素材 | 分包；图片压缩但保留 2x/3x；字体勿全量内嵌 |
| 内存约 200–300MB 上限 | 超限回收、降频 | 列表分页；大图释放；忌一次灌入超长 feed |

**清晰度**：优先高倍率切图与字号对比度，而非「调分辨率」幻想。  
**mock 对齐**：对齐信息架构、字段契约、间距层级；平台做不到的丝滑动效在方案里写明「平台上限」，勿用假动效糊弄验收。

### 13.1 mock 每句 = 数据契约

- 「轻解读 80–200 字」不是 CSS，是 Agent + 足够厚的 `evidenceBody`  
- 「原文摘录」必须场景 + 可溯源原话，禁止摘要冒充  
- 先固定 IA（kicker/title/lead/01/02/✦）再调 rpx
