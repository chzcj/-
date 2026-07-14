# S6 握手契约 · 字段空转 · 工作流稳定性审查

> 2026-07-14 · 对照 `docs/contracts/*` · S1–S5b 之后  
> 范围：机制链 / 综合 / 诊断 / digest / 日常检索 → 前台厚包  
> **未动**：语音/ASR、流式 NDJSON

---

## 总判断

三条管子叠在一起：

| 管子 | 状态 |
|------|------|
| S5 人设 | 已加厚 |
| S5b 机制产量 | SP/理论卡已抬到 10–20 |
| **S6 握手** | P0 + H1–H5/H7/H9/H10 已修；H6/H8 等 schema 大改 deferred |

只抬产量不修握手 → 库里有料，前台仍可能「吃不到」。

---

## P0（已修）

### 1. Router 预切饿死厚包

- **现象**：`pickFrontendReadPack` 厚包 `entryFacts≤40`，但 `router.ts` 先 `.slice(0,10)` 等，厚包永远吃不满。
- **修复**：router 预切对齐 `getFrontendReadSliceLimits()`（厚/薄双路径）。

### 2. `entryEvidence` 路径错误

- **现象**：契约要求四模块证据包摘要；编排把 `supportingEvidence`（episode/近期对话）塞进 `relevantEntryEvidencePacks`。
- **修复**：router 产出 `entryEvidencePackSummaries`；orchestration / how-to-speak 优先用它，无包时回退 episode。

---

## H1–H10 状态

| ID | 问题 | 状态 |
|----|------|------|
| H1 | handoff ecosystem/theory 写了没人读 | **已修**：digest 读入 |
| H2 | diagnosisHandoff ~3/8 字段 | **已修**：诊断 prompt/payload 吃满交接包 |
| H3 | synthesis→deep_mechanism 覆盖竞态 | **已修**：`mechanismLayerSource` 标记；router 日志消费 |
| H4 | builtSnapshot.deepMechanism 只留第1条 | **已修**：主1+次2，最长600字 |
| H5 | digest-builder / llm-digest / pick 三套 slice 不一致 | **已修**：`getDeepModelDigestSlices()` 统一 |
| H6 | `mechanismType` prompt 写理论名，代码用 strength 覆盖 | **deferred**：需 schema 拆分 |
| H7 | `correctionReceptivity` prompt vs TS 枚举冲突 | **已修**：open/resistant→high/low 映射 |
| H8 | parent narrative `labelTendency` 等写死 occasional | **deferred**：假字段，无读方 |
| H9 | hub / refresh TopMechanisms 薄切 | **已修**：hub + daily-refresh 均为 ≠low Top5 |
| H10 | synthesizer fail → legacy 丢掉 ecosystemMap+theoryMatches | **已修**：legacy 同传 |

---

## 死字段速查（2026-07-14 收尾后）

| 字段 | 状态 |
|------|------|
| handoff.ecosystemMap / theoryMatches | **已修**：digest 读 |
| diagnosisHandoff 全字段 | **已修**：诊断吃满 |
| SynthesisInput.existingNetwork | **已修**：摘要入 synthesis prompt |
| parentNarrativeStrings() | **已删**（死代码） |
| matrix.theoryCardId / ecosystemLayer | 仍偏后台；前台卡未展示 → deferred |
| possibleCounterEvidence | 恒 `[]` → deferred |
| H8 labelTendency 等 | 写死 occasional → deferred |

---

## 不稳定点（仍观察）

1. **JSON 截断**：classifier/synthesizer maxTokens 已抬，仍可能超长失败 → 静默 fallback（现已带 theory 上下文）。
2. **分数刻度**：synthesis scores 1–4 vs deep-mechanism 0.3–0.9 → deferred。
3. **early return**：facts&lt;3 不跑机制；digest LLM 叙事&lt;120 丢弃加深。

---

## 本批（S6 收尾）改动文件

- `src/lib/server/memory/deep-mechanism/pipeline.ts` — H10 + H7
- `src/lib/server/memory/deep-modeling/pick-deep-model-digest.ts` — export slices
- `src/lib/server/memory/deep-modeling/digest-builder.ts` / `llm-digest-builder.ts` — H5
- `src/lib/server/synthesis/pipeline.ts` — existingNetwork
- `src/lib/server/memory/retrieval/router.ts` — 删死函数 + 读 mechanismLayerSource
- `src/lib/server/profile/daily-refresh-agent.ts` — H9 Top5
- `prompts/background/deepMechanismReview.md` / `mechanismSynthesizer.md` — H7 文案
