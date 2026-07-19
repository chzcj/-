# SP 全链路深度规格（必读）

> 配套规则：`.cursor/rules/sp-content-depth.mdc`。改任何 SP 前先核对本表。
> 原则：**先构思这个 agent 在链路里要产出什么 → 反推 SP 要写到什么深度。** 便条级 SP 一律丰富到有血有肉。
> 第三轮验收清单：`.trae/documents/cursor-sp-review-checklist.md`

## 深度标杆

- 后台基准：`deepMechanismReview.md`（135 行）——含 20 理论卡、5 生态系统、置信度硬规则、判断流程、输出 schema。
- 前台基准：`parentFacingStyle.md`（188 行）、`dailyDialogueOrchestration.md`（146 行）。
- 已达标（v3 已对齐，2026-07-18）：`parentFacingStyle` / `dailyDialogueOrchestration` / `dailyPortraitRefresh` / `parentFacingCopy` / `deepModelingParentDigest` / `secondMeCollaboratorIdentity` / `deepMechanismReview`。

## 状态图例

| 状态 | 含义 |
|------|------|
| ✅ 达标 | 行数+内容深度+BFF/Worked Examples 齐全 |
| ✅ v3 | 已与 dossierSlice / interventionTargets 对齐 |
| 🟡 接近 | 行数略低于目标但内容完整，可迭代 |
| ⏳ 待补 | 仍明显偏薄 |

## 链路一 · 深度机制 / dossier 核心链

| Agent | 状态 | 当前→目标 | 备注 |
|-------|------|----------|------|
| ecosystemClassifier | 🟡 | ~90→90 | 有结构，可再加 worked examples |
| theoryMatcher | ✅ | 110→110 | 9 字段用法表 + 判断流程 |
| portraitSynthesizer | ✅ | 190→200 | 附录 A 样例锚点 |
| dossierPatcher | ✅ | ~120 | 第三轮已 enrich |
| mechanismSynthesizer | 🟡 | ~110 | legacy 兜底 |
| structuralRiskExtractor | ✅ | 82→80 | BFF + worked examples |

## 链路二 · 入口采集 / 建模链

| Agent | 状态 | 当前→目标 | 备注 |
|-------|------|----------|------|
| entryEvidenceBuilder | 🟡 | ~110 | 有 handoff |
| episodeExtractor | 🟡 | ~100 | evidenceTier 已写 |
| multiEntrySynthesis | ✅ | 113→90 | 跨入口 + worked examples |
| deepDiagnosis | ✅ | 86→90 | coreJudgment 样例 |
| profileSnapshot | ✅ | 83→70 | BFF 下游消费表 |

## 链路三 · 记忆写入 / 复核链

| Agent | 状态 | 当前→目标 | 备注 |
|-------|------|----------|------|
| memoryWrite | ✅ | 98→80 | 链式触发 dossier_patch |
| dailyDecompose | ✅ | 88→80 | 保守假设 + 样例 |
| modelReview | ✅ | 89→80 | 反证 + dossier 链 |
| memoryDepositionRetrieval | ✅ | 113→70 | 检索分类 + 样例 |

## 链路四 · digest / 画像刷新链

| Agent | 状态 | 当前→目标 | 备注 |
|-------|------|----------|------|
| familyBriefUpdater | ✅ | 85→80 | digest_update Job |
| boardUpdater | ✅ | 85→80 | judgmentChanges 区分 |
| deepModelDigestBuilder | ✅ | ~100→100 | dossier 投影链 |
| deepModelingParentDigest | ✅ v3 | 68→70 | dossier 7 段映射 |
| entryBuildStyle | 🟡 | ~70 | 采集语气 |

## 链路五 · 前台表达 / 交互链

| Agent | 状态 | 当前→目标 | 备注 |
|-------|------|----------|------|
| parentFacingStyle | ✅ v3 | 188 | ask_advice / dossierSlice |
| parentFacingCopy | ✅ v3 | ~188 | advice_from_dossier R6 |
| dailyDialogueOrchestration | ✅ v3 | ~150 | ask_advice 模式 |
| dailyPortraitRefresh | ✅ v3 | ~150 | dossier 输入六维 |
| communicationRehearsal | 🟡 | ~90 | 有 BFF |
| educationDiagnosis | 🟡 | ~80 | |
| tonightTaskGenerator | 🟡 | ~80 | interventionTargets |
| eventRecording | 🟡 | ~70 | |
| materialUnderstanding | 🟡 | ~70 | |
| multiViewCorrection | 🟡 | ~70 | |
| weeklyReview | 🟡 | ~80 | |
| familyPlanner | 🟡 | ~80 | |

## 链路六 · build/ 入口子模块

| Agent | 状态 | 当前→目标 | 备注 |
|-------|------|----------|------|
| entryHomeworkFollowUp/Summary | ✅ | 65/79 | 2 组 worked examples |
| entryDailyFollowUp/Summary | ✅ | ~75/65 | BFF 链完整 |
| entryCommunicationFollowUp/Summary | ✅ | ~75/65 | |
| entryFamilyFollowUp/Summary | ✅ | ~75/65 | |
| entryFinalFollowUp | ✅ | ~65 | 3 场景样例 |
| profileBuildSynthesis | ✅ | ~95 | AiSynthesisOutput 逐字段 |
| profileBuildDiagnosis | ✅ | ~95 | AiDiagnosisOutput 附录 |

## 单源原则

理论卡真源 `theory-cards.ts`（15×9 rich fields）。SP 不抄卡全文；由代码 `callAgentJson(..., { systemSuffix })` 注入。SP 只教「怎么用这 9 个字段」。

## 前台 SP 必含 · BFF 配合清单

| 必含块 | 内容 |
|--------|------|
| 链路位置 | 用户操作 → API/BFF → Agent → normalize → UI/Job |
| BFF 输入 | payload 字段 |
| BFF 输出消费 | normalize 后谁读 |
| 输出深度 | 逐字段字数/条数 |
| Worked Examples | ≥1 组好 vs 坏 |
| 反模式 | downstream 污染例 |

### 建档链 BFF（`/api/entry/analyze`）

```
capture 页 → POST stage=followUp|summary → entry-analyze.ts
→ normalize → UI → entry_evidence Job → deep_mechanism_review
```

### 日常链 BFF（`/api/daily/turn`）

```
daily 输入 → daily-turn-bff → retrieval/router → pickFrontendReadPack
→ orchestration → prose-section-stream / parentFacingCopy
→ memory_write → daily_decompose → dossier_patch
```

读包契约：`docs/contracts/read-contract.md`；**11 键**含 `dossierSlice`；`matchedMechanisms` 兜底。

## 验收

每个 SP：链路+BFF+判断流程+逐字段+Worked Examples+反模式+schema；dossier 链无理论名泄漏；`npm run typecheck` / `build` / `test-frontend-read-pack` 过。
