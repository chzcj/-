# 育见 · 全链路记忆利用率审计报告

> **审计日期**：2026-07-21  
> **范围**：审计-only（不改代码）  
> **方法真源**：[memory-utilization-audit-spec.md](./memory-utilization-audit-spec.md) + [dossier-v3-fullchain-audit-and-improvement-plan.md](./dossier-v3-fullchain-audit-and-improvement-plan.md)  
> **机器可读**： [memory-utilization-baseline-20260721.json](./memory-utilization-baseline-20260721.json) · [memory-utilization-audit-json-20260721.json](./memory-utilization-audit-json-20260721.json) · [memory-utilization-script-results-20260721.json](./memory-utilization-script-results-20260721.json)

---

## 1. 执行摘要

### 1.1 总体判定（更新 2026-07-19）

**「利用率 <5%」仍过于绝对**，但 **结构层（dossier v3）利用率确认为 0%**——生产 34 家庭 `deep_model_digest.dossier` 全覆盖率为 0，`PORTRAIT_V3` 仍未开启。

| 场景 | 利用率 | 证据摘要 | vs 2026-07-19 |
|------|--------|----------|---------------|
| 交流 Tab prose（visible） | **中高** | 厚包默认开；replay 2 样本 rubric 13+/18；entryFacts=6 注入 | 持平 |
| 交流 hidden section | **低→中** | dossierSlice 空时全 retrievalPack；**非空时丢 pack（断点仍 open）** | 持平 |
| 画像 Tab 六卡 | **中** | hub + daily-refresh LLM；deep-modeling audit 某户 portraitCardsRich=0 | 部分退化 |
| 画像 chip 子页 | **低→中** | 只读 portraitCards.lead/sections；hub 的 pendingHypothesesList/structuralTensions 未接线 UI | 持平 |
| 预演 L1–L4 | **中** | end 步骤 **已修**接 endData；handoff **部分修**；scenes 缓存+digest 注入 | **改善** |
| 对话分析 V2-F | **中** | deepModelDigest 校准 + transcript 主源；旧记录 v2 适配 | **新增** |
| 建档结果页 | **低** | Hero 仍 hardcode；下方 coreText 已读 snapshot | 持平 |
| 任务 Tab | **低（设计）** | 弱记忆耦合 | intentional |
| dossier v3 结构层 | **无** | 0/34 has_dossier | **持平** |

### 1.2 核心结论（一页）

1. **AI 在产出层有工作**：`mechanismNarrative`（demo 701 字）、`anchoredFacts`（24 条）、机制矩阵 demo 约 5–6 条/网络（较文档「2 条」有改善）。
2. **整合性画像（dossier）从未上线**：`PORTRAIT_V3` 未设 → portraitSynthesizer / dossier_patch 实质空转 → 前台只能靠扁平 digest + entryFacts **拼凑**，对应用户「瞎猜、没整体思维」。
3. **消费层断点仍集中在 BFF hidden payload、建档 Hero、enrich 兜底**；预演 end **已修**；handbook enriched candidate **非 dead write**（文档过时）。
4. **契约静态审计全绿**；**运行时利用率**需 dossier 开启 + hidden payload 修复后才可显著提升。

---

## 2. 生产基线（Phase 0）

来源：SSH 只读 `ubuntu@81.70.228.8:/home/ubuntu/apps/yujian` · 2026-07-21

| 指标 | 值 | 判定 |
|------|-----|------|
| `PORTRAIT_V3` | **未设**（grep 未命中） | ❌ 默认关 |
| `deep_model_digest.dossier` 有值家庭 | **0 / 34** | ❌ 与 07-19 一致 |
| `deep_mechanism_review` succeeded | 177 | ✅ Job 在跑（旧路径） |
| `dossier_patch` succeeded | 8 | ⚠️ flag 关时多为 no-op |
| `digest_update` succeeded | 1466 | ✅ |
| 机制矩阵 sample | f_demo 5–6 条/行 | ⚠️ 仍低于 Layer3 目标 ≥5 均值 |
| Top 活跃家庭 | fam_1780644661390_km36wj 271 turns | 抽样候选 |

**f_demo 深度 digest**：mechanismNarrative 701 字 · anchoredFacts 24 · **hasDossier=false**

---

## 3. 自动化脚本矩阵（Phase 1）

| 脚本 | 结果 |
|------|------|
| `npm run audit:memory-contract` | ✅ 19/19 |
| `npm run test:frontend-read-pack` | ✅ 38/38 |
| `node scripts/test-retrieval-packet.mjs` | ✅ 14/14 |
| `npm run test:contracts` | ✅ |
| `node scripts/audit-prompt-registry.mjs` | ✅ |
| `npm run audit:memory` | ✅ 12 pass · 1 warn（无 TEST_PASSWORD） |
| `node scripts/audit-deep-modeling-pipeline.mjs` | ❌ pass=false（portraitCardsRich=0） |
| `npm run test:xiaoyin-corpus` | ⚠️ DEMO_DISABLED，未跑通 |
| **`npm run audit:fullchain`** | ⚠️ **package.json 未定义**；手动等价已通过 |

新增：**`npm run audit:memory-utilization`** → [scripts/audit-memory-utilization.mjs](../scripts/audit-memory-utilization.mjs)

---

## 4. 分场景 Trace 表（Phase 2）

| 场景 | API/Job | 记忆读路径 | 写入层 | UI 消费 | 空转/断裂 | 利用率 |
|------|---------|------------|--------|---------|-----------|--------|
| 交流 visible prose | `POST /api/daily/stream` | `daily-turn-bff` → `buildDailyProsePayload` + `pickFrontendReadPack` | turn_events + daily_updates | MP/Web 气泡 | 有效 | **中高** |
| 交流 hidden section | `fillDailySectionCopy` | `parent-facing-copy.ts:106` dossierSlice>0 时 **仅** dossierSlice+digest | — | hidden sections | **断裂**：丢 retrievalPack | **低** |
| 画像 Tab | `GET /api/profile/hub` + `daily-refresh` | built + digest + daily_ui_snapshot + enrich | daily_ui_snapshot | portraitCards / thinkingChips | partial：watermark/stale 未全用 | **中** |
| 画像 deep/evidence/verify | 子页本地 | portraitCards.*.lead/sections | — | 单卡展开 | 未读 hub hypotheses/anchoredFacts | **低→中** |
| 预演 L1–L4 | `/api/rehearsal/*` | thick pack + deepModelDigest | rehearsal 本地 state | endCopy / scenes | handoff 部分空 | **中** |
| 对话分析 V2-F | dialogueAnalysisV2 | transcript + digest 校准 | dialogue_analyses.rehearsal_seed.v2 | V2-F 页 | 旧记录无 v2 需 batch | **中** |
| 建档结果 | build + hub | built_profile_snapshots | built_profile | result Hero+summary | **Hero hardcode** | **低** |
| 任务 Tab | `/api/tasks` | 弱 | tasks | 列表 | intentional | **低** |

### dossier v3 三链

| 链 | 关键文件 | 状态 | 利用率问题 |
|----|----------|------|------------|
| **产出** | `portrait-v3-flags.ts` · `pipeline.ts` | PORTRAIT_V3=0 | dossier 永不生成 |
| **更新** | `queue.ts` · `dossier-patcher.ts` · `should-reconceptualize.ts` | 代码完整，flag 关 | patch/L2 不跑；counter_evidence 链待 flag 后复测 |
| **消费** | `dossier-slicer.ts` · front SP | slice 扁平 string[] | dailyDialogueOrchestration **零** v3 段名；hidden paradox |

**SP dossier v3 五段覆盖**（静态扫描）：

| SP | v3 段 |
|----|-------|
| dailyPortraitRefresh | 全五段 ✅ |
| deepModelingParentDigest | 全五段 ✅ |
| communicationRehearsal | workingHypothesis, sceneReadings（部分） |
| dailyDialogueOrchestration | **仅 dossierSlice，无段名** ❌ |

---

## 5. 18 断点状态表（含 delta）

| # | 断点 | 状态 | 文件 | 备注 |
|---|------|------|------|------|
| 1 | hidden payload 丢 retrievalPack | **open** | parent-facing-copy.ts:106 | 审计 JSON 确认 breakpointOpen=true |
| 2 | 预演 handoff 空 | **partial** | DailyAiMessage.tsx:148 | AI 动作写 handoff；daily 直跳无；无 retrievalPackDigest |
| 3 | 预演 end hardcode | **fixed** | rehearsal/index.tsx:795 | getRehearsalEndCopy(endData) |
| 4 | 建档 Hero hardcode | **open** | result/index.tsx:132 | coreText 在下方卡片已读 |
| 5 | enrich tensions 学术 title | **open** | portrait-card-enrich.ts:87 | 直接塞 structuralTensions |
| 6 | taskTitle 孤儿 | **open** | daily-turn-bff.ts | fillDailySectionCopy 产出未消费 |
| 7 | enrich 静态空话 | **open** | portrait-card-enrich.ts:166 | |
| 8 | 主1/次2 禁止词 | **open** | parentFacingStyle.md | 仅 portraitRefresh 单独声明 |
| 9 | daily/rehearsal SP v3 五段 | **open** | dailyDialogueOrchestration.md | |
| 10 | dailyPortraitRefresh parentFacingStyle | **partial** | registry 拼装 | 需查 combined system |
| 11 | HubPayload 未消费 | **open** | profile/index.tsx | structuralTensions/highlights 有 state 无 applyHubData 赋值；watermark stale 未驱动 UI |
| 12 | chip 子页读不全 | **open** | profile/deep\|evidence\|verify | |
| 13 | thinkingChips fallback | **open** | daily/index.tsx | |
| 14 | 不回传 retrievedContextSnapshot | **open** | dailyStream.ts | BFF 侧组装 |
| 15 | THEORY_CARDS 15×9 文档 | **open** | theory-cards.ts | 实际 20×7 rich |
| 16 | profileChipPanels | **obsolete** | — | 2026-07-14 已删 |
| 17 | deep_mechanism_handoffs | **partial** | handoff-store.ts | 仅 audit 读 |
| 18 | saveEnrichedHandbookCandidate | **obsolete** | handbook-admission.ts | 有 reader |

**统计**：open 12 · partial 3 · fixed 1 · obsolete 2

---

## 6. 契约 drift

| 项 | 文档 | 代码 | 影响 |
|----|------|------|------|
| thick slice 8 键 | read-contract.md 12/10/16… | SLICE_LIMITS_THICK 24/20/32… | 文档低估实际上限（非 P0） |
| 层名 | family_interaction_cycles | interaction_cycles | 命名 drift |
| memory_write 链 | memory-write.md 日桶→deep_mechanism | queue.ts 注释仅 episode 链式 | 文档过时 |
| audit:fullchain | FULLCHAIN-SELF-CHECK.md | package.json 无 | 工具链缺口 |

---

## 7. Prose 原话锚定抽检（Phase 1.3）

**工具**：生产 `replay-daily-prose.mjs --limit=2 --family=f_demo`  
**报告**：`.trae/documents/prose-replay-20260721.md`（服务器）

| 样本 | pack | Before rubric | After rubric | 原话锚定 |
|------|------|---------------|--------------|----------|
| 作业拖延+知道了 | entryFacts=6, dossierSlice=0 | 13/18 | 12/18 | 行为复述（「知道了」）非 verbatim 子串；archiveFit=2 |
| 催三遍+吼 | entryFacts=6, dossierSlice=0 | 14/18 | 14/18 | 同上 |

**判定**：交流 visible prose **中高**——模型能基于机制叙事展开，但 **dossierSlice=0** 时 hidden 走全 pack；一旦 PORTRAIT_V3 开启且 slice 非空，hidden 利用率可能 **反降**（断点 1 悖论）。

---

## 8. 工具链缺口

1. `npm run audit:fullchain` 未写入 package.json  
2. 无 automated prose-vs-facts 锚定 scorer（仅 replay rubric）  
3. `audit-memory-utilization.mjs` 读包填充率依赖 DB；turn_events 行级 snapshot 字段路径与 replay 不一致，需统一契约  

---

## 9. 整改优先级队列（本轮不实施）

与 [dossier-v3 plan Layer 1](./dossier-v3-fullchain-audit-and-improvement-plan.md) 对齐：

### P0（展示层，1–2 天）

| # | 动作 | 文件 |
|---|------|------|
| P0-1 | hidden payload 保留 retrievalPack 关键子集 | parent-facing-copy.ts |
| P0-2 | handoff 补 retrievalPackDigest + daily 直跳 | DailyAiMessage + daily/index |
| P0-3 | 建档 Hero 读 coreJudgment/growth | result/index.tsx |
| P0-4 | enrich tensions 翻译/不兜底 | portrait-card-enrich.ts |
| P0-5 | **PORTRAIT_V3=1**（需用户授权生产 flag）+ smoke | .env.local + run-portrait-v3-smoke.mjs |

### P1（1–2 周）

- dossierSlice 结构化 / 全 SP v3 五段  
- counter_evidence → L2；predictions 必产；freshness  
- HubPayload stale 接线；chip 子页读 hypotheses  
- taskTitle 接线或删除  

### P2（1–2 月）

- THEORY_CARDS exo/macro rich 补齐  
- dossier 质量评分 + stale 降级  
- dead layer 写入彻底删除；audit:fullchain npm 别名  

---

## 10. 验收命令附录

```bash
# 基线（生产 SSH）
grep PORTRAIT_V3 /home/ubuntu/apps/yujian/.env.local
psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE data ? 'dossier' AND (data->'dossier')::text NOT IN ('null','{}')) AS has_dossier, count(*) AS total FROM memory_layer_items WHERE layer_name='deep_model_digest' AND item_id='latest';"

# 静态 + 契约
npm run audit:memory-contract
npm run test:frontend-read-pack
node scripts/test-retrieval-packet.mjs
npm run test:contracts && node scripts/audit-prompt-registry.mjs

# 利用率 JSON
npm run audit:memory-utilization

# 运行时
npm run audit:memory
node scripts/audit-deep-modeling-pipeline.mjs [phone]   # 需 DATABASE_URL

# Prose 抽检（生产）
node --import tsx scripts/replay-daily-prose.mjs --limit=5 --family=f_demo
```

---

## 11. 相对 2026-07-19 文档的修正

| 原说法 | 2026-07-21 实情 |
|--------|-----------------|
| 预演 end 全 hardcode | **已修**（endCopy） |
| saveEnrichedHandbookCandidate 无 reader | **obsolete**（handbook_admit_candidates） |
| 机制矩阵仅 2 条 | demo 现 5–6 条（仍稀疏） |
| dossier 0/34 | **仍为 0/34** |
| PORTRAIT_V3 未开 | **仍未开** |

---

**审计结论句**：结构层 dossier 利用率 **0%**（配置未开）；展示层交流 visible **中高**、画像 **中**、预演 **中**（end 已修）；最大消费断点仍为 **hidden section 丢 retrievalPack** 与 **PORTRAIT_V3 关导致整合画像从未生成**。整改卷应以本报告 JSON 基线为 before 对照。

**Trae Part 5 差距对照表**：[memory-utilization-part5-gap-table-20260721.md](./memory-utilization-part5-gap-table-20260721.md)
