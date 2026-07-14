# S6 握手契约 · 字段空转 · 工作流稳定性审查

> 2026-07-14 · 对照 `docs/contracts/*` · S1–S5b 之后  
> 范围：机制链 / 综合 / 诊断 / digest / 日常检索 → 前台厚包  
> **未动**：语音/ASR、流式 NDJSON、小程序 onboarding WIP

---

## 总判断

三条管子叠在一起：

| 管子 | 状态 |
|------|------|
| S5 人设 | 已加厚 |
| S5b 机制产量 | SP/理论卡已抬到 10–20 |
| **S6 握手** | **仍有稀释与死字段**；本批已修 2 个 P0 |

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

## P0 / P1（仍待，勿与 WIP 混推）

| ID | 问题 | 冲突面 |
|----|------|--------|
| H1 | handoff ecosystem/theory 写了没人读 | **已修**：digest 读入 |
| H2 | diagnosisHandoff ~3/8 字段 | **已修**：诊断 prompt/payload 吃满交接包 |
| H3 | synthesis→deep_mechanism 覆盖竞态 | **已修**：`mechanismLayerSource` 标记 |
| H4 | builtSnapshot.deepMechanism 只留第1条 | **已修**：主1+次2，最长600字 |
| H5 | digest-builder / llm-digest / pickDeepModelDigest **三套 slice 表不一致** | 动 digest 双路径 |
| H6 | `mechanismType` prompt 写理论名，代码用 strength 覆盖成 core/stage/local | schema 语义冲突 |
| H7 | `correctionReceptivity` prompt=`open|…` vs TS=`high|medium|low` | 枚举冲突 |
| H8 | parent narrative `labelTendency` 等写死 `occasional` | 假字段 |
| H9 | hub TopMechanisms 仍 slice(0,2)（家长 Top5 页是另一路径，属展示策略） | 产品策略，非 bug |
| H10 | synthesizer fail → legacy monolith **丢掉** ecosystemMap+theoryMatches | 双路径不一致 |

---

## 死字段速查

| 字段 | 写 | 读 |
|------|----|----|
| handoff.ecosystemMap / theoryMatches | deep-mechanism | 无（审计脚本除外） |
| matrix.theoryCardId / ecosystemLayer | DB | 运行时几乎无消费 |
| diagnosisHandoff.keyEvidencePath 等 | synthesis | 诊断不用 |
| possibleCounterEvidence | 恒 `[]` | — |
| SynthesisInput.existingNetwork | 声明 | 未用 |
| parentNarrativeStrings() | — | 无调用方 |

---

## 不稳定点

1. **JSON 截断**：classifier/synthesizer maxTokens 已抬，仍可能超长失败 → 静默 fallback。
2. **竞态**：synthesis → enqueue deep_mechanism → 矩阵被覆盖；交流若夹在中间读旧网。
3. **分数刻度**：synthesis scores 1–4 vs deep-mechanism 0.3–0.9。
4. **early return**：facts&lt;3 不跑机制；digest LLM 叙事&lt;120 丢弃加深。

---

## 代码冲突面（与本地 WIP）

| 区域 | 冲突风险 |
|------|----------|
| `miniprogram/.../onboarding`、`login`、`HiFiMainShell` | **正交**——勿与本 BFF 握手改动混 commit |
| `router.ts` / `orchestration` / `frontend-read-pack` | **高冲突**——S6 主战场 |
| `deep-mechanism/pipeline.ts` | 与 S5b 同文件；再改需串行 |
| 语音 ASR 文件 | **红线禁止** |

结论：**不会与小程序 onboarding WIP 文件冲突**；会与其他 Agent 同时改 memory/retrieval 冲突——改前 `sync:gitee` + 读 HANDOFF。

---

## 本批改动文件

- `src/types/database.ts` — `entryEvidencePackSummaries`
- `src/lib/server/memory/retrieval/router.ts` — 厚包预切 + 证据包摘要 + flatten 补 receptivity
- `src/lib/server/orchestration/pipeline.ts` — entryEvidence 映射
- `app/api/daily/how-to-speak/route.ts` — 同上

未改：机制条数 UI Top5、握手 H1–H10 大修、onboarding WIP。
