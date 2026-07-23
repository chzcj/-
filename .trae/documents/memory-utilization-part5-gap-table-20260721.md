# Trae Part 5 · 七条验收 · 差距对照表

> 对照真源：[memory-utilization-audit-spec.md](./memory-utilization-audit-spec.md) Part 5  
> 证据日期：**2026-07-21**（生产 SSH 基线 + 本地/生产脚本 + 代码静态）  
> 相关报告：[memory-utilization-audit-report-20260721.md](./memory-utilization-audit-report-20260721.md)

**图例**

| 验收 | 含义 |
|------|------|
| ✅ | 当前可核验通过 |
| ⚠️ | 部分通过 / 有条件通过 / 仅 demo 或仅 visible 路径 |
| ❌ | 未达标 |
| — | 不适用或无法跑通 |

**总览**

| # | 验收域 | 总判定 | 阻塞整改 |
|---|--------|--------|----------|
| 1 | 交流 | ⚠️ | hidden payload；verbatim 锚定 |
| 2 | 画像 Tab | ⚠️ | tensions 学术 title；rich 卡不足 |
| 3 | chip 子页 | ❌ | 未读 pendingHypothesesList |
| 4 | 预演 | ⚠️ | handoff；L3 模拟 hardcode |
| 5 | 建档结果 | ❌ | Hero hardcode |
| 6 | 契约门控 | ⚠️ | audit:fullchain 无 npm 别名 |
| 7 | 小尹语料 | — | DEMO_DISABLED 未跑通 |

---

## 1 · 交流

Trae 原文：*turn_events.retrievedContextSnapshot 含 entryFacts；prose 抽检含用户原话或事实；hidden section payload 含 retrievalPack*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 1a 写入 snapshot | 每轮 turn 落库 `retrievedContextSnapshot`，且含 `entryFacts` | `pipeline.ts:212` 写入 `output.retrievedContext`；`replay-daily-prose` 从 turn 读 pack 显示 **entryFacts=6**（f_demo） | 生产 turn 行级 JSON 路径与 replay 字段需统一文档；非阻塞 | ⚠️ |
| 1b visible prose 锚定 | 输出含用户原话或 pack 事实 | 生产 replay 2 样本 rubric **13–14/18**；文案有「知道了」「检查讲错题」等**行为复述**，**非** entryFacts 子串 verbatim；archiveFit≈2/3 | SP 未强制 verbatim；抽检无自动 scorer | ⚠️ |
| 1c hidden payload | hidden section LLM 输入含 **retrievalPack**（或等价 11 键） | `parent-facing-copy.ts:106-114`：**dossierSlice.length>0 时仅** dossierSlice+digest+userText，**无 retrievalPack**；当前 dossier 全 null → dossierSlice=0 → hidden **走全 pack** | **结构性断点**：开 PORTRAIT_V3 后 hidden **必 fail**；即使现在 dossier 空，代码路径仍错误 | ❌ |
| 1d 客户端回传 | （Trae 断点 14 相关） | `dailyStream.ts` POST 仅 text/warmTurn/recentSectionIds，**不回传** snapshot | 跨轮靠 BFF 侧组装，非 Part 5 明文要求但影响连续性 | ⚠️ |

**本条结论**：visible 交流 **⚠️ 有条件通过**；hidden **❌（代码层面）**；Part 5 整体 **⚠️ 未达标**。  
**整改**：P0 `parent-facing-copy.ts` 保留 entryFacts/childQuotes/parentVerbatimSnippets 子集（Trae L1-2）。

---

## 2 · 画像 Tab

Trae 原文：*portraitCards 六卡 summary 非占位；refreshedAt 随交流/进 Tab 更新；tensions 卡无学术 title*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 2a 六卡 summary | 六卡 summary 非「整理中/占位/空话」 | hub + `daily-refresh` → `enrichPortraitCards`；`audit-deep-modeling-pipeline` 测户 **portraitCardsRich=0**（≥120 字富卡 <2） | 部分租户卡片偏薄或 enrich 兜底 | ⚠️ |
| 2b refreshedAt | 随交流或进 Tab 更新 | hub 返回 `refreshedAt`；MP `applyHubData` **会 set**；进 Tab **5min 防抖** POST daily-refresh + **90s cache** | Job 未完成时 stale 水印 **uiStale/digestStale 未驱动 UI**（Module 3） | ⚠️ |
| 2c tensions 无学术 title | tensions 卡家长可读，无「高情感接纳与低行为结构…」类标题 | `portrait-card-enrich.ts:84-88` **直接** `pack.structuralTensions` → items；`preferLlm=false` 或 LLM 空时 **必风险** | 未翻译/未兜底跳过 | ❌ |
| 2d Hub 字段消费 | （Trae 断点 11） | `pendingHypothesesList`/`highlights`/`structuralTensions` **hub 有、applyHubData 不接** | 画像 Tab 主列表未用假设列表/高光 | ⚠️ |

**本条结论**：**⚠️ 未达标**（2c 为硬 fail 条件）。  
**整改**：P0 enrich tensions（Trae L1-5）；P1 Module 3 Job↔UI 时序。

---

## 3 · chip 页（deep / evidence / verify）

Trae 原文：*deep/evidence/verify 读 pendingHypothesesList；无「主1/次2」压缩串*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 3a 读 pendingHypothesesList | chip 子页读 hub **`pendingHypothesesList`** | `deep/index.tsx` 只读 **`portraitCards.growth` lead**；`evidence` 读 behavior.sections；`verify` 读 hypotheses.sections | **未读** hub 假设列表 / anchoredFacts | ❌ |
| 3b 无「主1/次2」 | UI 无内部压缩串 | 仅在 `dailyPortraitRefresh.md` SP 禁止；**无运行时 filter**；enrich/LLM 漏网仍可能出 | 依赖 SP 自觉，无 BFF clamp | ⚠️ |
| 3c 卡片详情 API | （Trae 链路 5 单列） | `/api/profile/card/:id` 存在；本次未逐屏验收 chipPanelFields | 需与小尹语料 #7 联动 | — |

**本条结论**：**❌ 未达标**（3a 硬 fail）。  
**整改**：P1 MP 子页接 hub `pendingHypothesesList` + digest anchoredFacts；P1 禁止词 BFF 侧 clamp。

---

## 4 · 预演

Trae 原文：*handoff 带 retrievalPack 摘要；end 步骤文案含该用户短板/场景（非通用话术）*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 4a handoff | 交流→预演带 **retrievalPack 摘要**（Trae：`entryFacts` 前 3 + `matchedMechanisms` 前 2） | `DailyAiMessage.tsx:148` 在 AI「去预演」动作写 storage；**`daily/index.tsx` 不写**；payload **无** `retrievalPackDigest` | 直跳预演仍空；有动作也不带 pack 摘要 | ❌ |
| 4b end 步骤 | closingAdvice / childLikelyHearing / saferVersion **来自 endData**，非通用句 | `step==='end'` 使用 **`getRehearsalEndCopy(endData)`** | **end 页** ✅ | ✅ |
| 4c L3 模拟进行中 | （Trae 断点 3 扩展）文案贴该户场景/防御 | `statusText` 默认「孩子有点烦，防御比较高」；`openingHint` 兜底「把你推开」；`openingChild`「你别催我…」（`rehearsal/index.tsx` 109,358-380） | **L3 active/confirm 仍大量 hardcode** | ❌ |
| 4d 内部机制字段 | Trae L1-4 曾提 likelyTriggeredMechanisms 全量 | 07-21 预演契约：**家长 UI 已移除**机制/证据内部字段 | 与 Trae 旧句冲突；**以产品契约为准**：家长只见 endCopy 三块 | ✅（按现行契约） |

**本条结论**：**⚠️ 未达标**（4a+4c fail；4b pass）。Trae Part 5 写「end 步骤」— **end 过，整条预演不过**。  
**整改**：P0 handoff + retrievalPackDigest（Trae L1-3）；P0 L3 接 brief/analyze 流式字段（Trae L1-4 扩展）。

---

## 5 · 建档结果

Trae 原文：*Hero 文案含 snapshot.coreJudgment 摘要*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 5a Hero 三行 | kicker/title/copy 含 **coreJudgment** 或 growth 首句 | `result/index.tsx:132-135` **hardcode**：「画像已生成 / 可以开始交流和预演了 / 下面的理解…」 | Hero 与 snapshot **完全脱节** | ❌ |
| 5b 下方卡片 | （Trae 未写但已实现） | 同页 `coreText` 已读 `portraitCards.growth` / `coreJudgment` | 内容在 Hero **下方**，非 Hero | ⚠️ |

**本条结论**：**❌ 未达标**（Trae 验的是 Hero）。  
**整改**：P0 Hero 读 coreJudgment 前 30 字 + growth summary 前 60 字（Trae L1-5）。

---

## 6 · 契约门控

Trae 原文：*`npm run audit:fullchain` + `test-frontend-read-pack` 通过*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 6a test-frontend-read-pack | 38/38 通过 | 2026-07-21 跑：**38 pass, 0 fail** | — | ✅ |
| 6b audit:fullchain | npm 一键门控 | **`package.json` 无此 script**；手动 `test:contracts && audit-prompt-registry` **通过** | 工具链缺口；CI/人工易漏 | ⚠️ |
| 6c audit:memory-contract | （Part 1 验收） | 19/19 通过 | — | ✅ |
| 6d read-contract drift | （非 Part 5 明文） | 9 键 thick 上限 doc≠code；interaction_cycles 命名 drift | 不阻塞 Part 5 但影响审计 | ⚠️ |

**本条结论**：**⚠️ 未严格达标**（6a ✅，6b 缺别名）。  
**整改**：P2 补 `"audit:fullchain": "npm run test:contracts && node scripts/audit-prompt-registry.mjs"`。

---

## 7 · 小尹语料

Trae 原文：*test:xiaoyin-corpus 全链路 profile 阶段 chipPanelFields 有值*

| 子项 | Trae 期望 | 当前证据 | 差距 | 判定 |
|------|-----------|----------|------|------|
| 7a 全链路 corpus | `CORPUS_LIMIT=n npm run test:xiaoyin-corpus` profile 阶段 **chipPanelFields 非空** | 2026-07-21：`CORPUS_LIMIT=1 CORPUS_PHASE=profile` → **`DEMO_DISABLED`**，auth 失败，**未跑到 profile** | 需 `TEST_PHONE`/`TEST_PASSWORD` 或开放 demo | — |
| 7b 替代证据 | — | `audit-deep-modeling-pipeline` 单户 portraitCardsRich=0 | 与 7a 方向一致偏负 | ⚠️ |

**本条结论**：**— 未跑通，无法签收**；倾向 **❌  until 重跑**。  
**整改**：用真实账号重跑；或修 demo 路由；验收 profile chipPanelFields JSON。

---

## 汇总矩阵（Part 5 七条 → 整改优先级）

| # | 验收域 | 判定 | 首要差距 | Trae 整改层 |
|---|--------|------|----------|-------------|
| 1 | 交流 | ⚠️ | hidden 丢 retrievalPack | Layer 1 · L1-2 |
| 2 | 画像 Tab | ⚠️ | tensions 学术 title | Layer 1 · L1-5 |
| 3 | chip 子页 | ❌ | 未读 pendingHypothesesList | Part 3 · P1 |
| 4 | 预演 | ⚠️ | handoff + L3 hardcode | Layer 1 · L1-3/L1-4 |
| 5 | 建档结果 | ❌ | Hero hardcode | Layer 1 · L1-5 |
| 6 | 契约 | ⚠️ | 无 audit:fullchain npm | Part 4 · P2 |
| 7 | 小尹语料 | — | 未执行 | Part 4 · 观测 |

**Part 5 签收口径（严格）**：7 条中 **明确 ✅ 仅 1 条子项（4b end 页）+ 6a 契约**；**整表不可签收**。  
**Part 5 签收口径（宽松 · visible 路径）**：交流主气泡 + 契约静态 + 预演 end ≈ **3 域部分通过**，仍 **不可** 替代 1c/3a/5a/4a 硬 gap。

---

## 与 dossier v3 的交叉（Trae 第二份文档）

Part 5 **未写** dossier，但以下 gap **开 PORTRAIT_V3 后会恶化或新暴露**：

| Part 5 条 | dossier 开启后 |
|-----------|----------------|
| 1c hidden | **必 fail**（除非先 L1-2） |
| 1b prose | 依赖 dossierSlice 结构化 + SP 五段（Layer 2） |
| 2a 画像 | dossier 投影进 portraitRefresh 质量依赖 predictions 必产 |
| 4 预演 | handoff/end 应读 interventionTargets / workingHypothesis |

**建议整改顺序（对齐 Trae Layer 1）**：

1. L1-2 hidden payload（保 Part 5 #1c）  
2. L1-3 handoff + retrievalPackDigest（#4a）  
3. L1-4 预演 L3 接流式字段（#4c）  
4. L1-5 Hero + enrich tensions（#5a #2c）  
5. L1-1 PORTRAIT_V3=1（结构层；**授权后**）  
6. 重跑 Part 5 #6 #7 门控  

---

## 复验命令（逐条）

```bash
# 1 交流 hidden（静态）
npm run audit:memory-utilization
# 看 sections.hiddenPayloadDiff.breakpointOpen === true 即 fail

# 1 prose 锚定
# 生产：node --import tsx scripts/replay-daily-prose.mjs --limit=5 --family=f_demo

# 2 画像 tensions：hub 返回 structuralTensions → 查 MP 卡片是否原样展示

# 3 chip：grep pendingHypothesesList miniprogram/src/pages/profile/deep

# 4 handoff：grep setStorageSync.*rehearsal_handoff miniprogram/src/pages/daily

# 5 Hero：grep "可以开始交流和预演了" miniprogram/src/packageOnboarding/pages/result

# 6 契约
npm run test:frontend-read-pack
npm run test:contracts && node scripts/audit-prompt-registry.mjs

# 7 小尹
TEST_PHONE=... TEST_PASSWORD=... CORPUS_PHASE=profile npm run test:xiaoyin-corpus
```

---

*本表为 Trae Part 5 的逐条差距对照；若代码或生产 flag 变更，请更新「当前证据」列并重跑复验命令。*
