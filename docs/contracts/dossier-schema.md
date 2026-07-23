# Dossier Schema 契约（v4）

> 类型定义：`src/types/family-understanding-dossier.ts`
> 生产 SP：`prompts/background/portraitSynthesizer.md`
> 切片逻辑：`src/lib/server/memory/dossier/dossier-slicer.ts`

## FamilyUnderstandingDossier（10 段 + 元数据）

| 段 | 类型 | 含义 | 进 dossierSlice？ |
|---|---|---|---|
| `familyStruct` | DossierFactor[] | 家庭结构因素 | ✅ |
| `fivePs` | { presenting/predisposing/precipitating/perpetuating/protective } | 五P模型 | ✅ |
| `sceneReadings` | DossierSceneReading[] | 场景解读（protectiveMix 交织配比） | ✅ |
| `parentPerspectives` | DossierParentPerspective[] | 家长视角 | ✅ |
| `workingHypothesis` | { text, predictions? } | 工作假设 | ✅ |
| `interventionTargets` | DossierInterventionTarget[] | 干预目标 | ✅ |
| `integratedSynthesis` | string | 整合综合 | ✅ |
| `alternativeReadings` | DossierAlternativeReading[] | 竞争假设 | ✅ |
| `ecologicalCalibration` | string | 内部段 | ❌ 不进 slice |
| `evidenceLedger` | string[] | 证据账本 | ❌ 不进 slice |

## 子类型

### DossierFactor
- `id?`: string — 因素稳定 id（跨版本不变，只调 confidence）
- `label`: string
- `confidence`: number (0-1)
- `evidenceSummary?`: string — 人话事实 + 来源标签（N/M 场景）
- `sceneNote?`: string

### DossierSceneReading（交织纪律核心）
- `scene`: string — 场景名
- `protectiveMix?`: Record<string, number> — 保护因素混合权重（同一因素在不同场景不同配比）
- `mainPerpetuatingId?`: string — 指向某 perpetuating 因素 id
- `reading`: string — 该场景下的解读

### DossierPrediction（v4 加 confidence + evidenceRefs）
- `id`: string
- `text`: string — 可证伪预测
- `status?`: 'unverified' | 'failed' | 'verified'
- `confidence?`: number (0-1) — **v4 新增**
- `evidenceRefs?`: EvidenceRef[] — **v4 新增**，预测依据

### DossierAlternativeReading
- `id`: string (H_A/H_B)
- `hypothesis`: string
- `confidence`: number (0-1)
- `distinguishingEvidence?`: string — 需什么证据区分

## v4 新增约束

1. **predictions 带 confidence**：区分高把握与低把握预测
2. **EvidenceRef id 化**：factor/mechanism/prediction 的 evidenceSummary 可回溯到 atom_id
3. **机制间 competesWith 边**：alternativeReadings 必须保留 ≥2 假设
4. **认识论隔离**：inferred 的判断不混进 workingHypothesis 当定论
5. **稀疏数据诚实**：<3 条证据时 workingHypothesis.text 写「证据尚不足以做稳定整合」

## dossierSlice 切片规则（sliceForDaily）

按 query 关键词路由：
- query 含「怎么办」→ 取 interventionTargets
- query 含「我/家长」→ 取 parentPerspectives
- 否则 → 取 familyStruct + perpetuating + sceneReadings

ecologicalCalibration 永远不进 slice（理论隐身）。
