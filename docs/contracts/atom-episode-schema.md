# Atom & Episode Schema 契约（v4）

> 类型定义：`src/lib/server/db.ts`（AtomRow / EpisodeRow / fact_atoms / evidence_episodes）
> 抽取 pipeline：`src/lib/server/memory/episode/pipeline.ts`
> 抽取 SP：`prompts/background/episodeExtractor.md`

## fact_atoms 表（16 列，v4 新增 6 列）

| 列 | 类型 | 默认 | v4 新增？ |
|---|---|---|---|
| atom_id | TEXT PK | — | |
| episode_id | TEXT NOT NULL | — | |
| family_id | TEXT | 'f_demo' | |
| child_id | TEXT | 'c_demo' | |
| content | TEXT NOT NULL | — | |
| source_type | TEXT NOT NULL | — | |
| fact_type | TEXT | — | |
| is_high_value | BOOLEAN | FALSE | |
| evidence_strength | TEXT | 'medium' | |
| embedding | vector(1024) | — | |
| **epistemic_status** | TEXT | 'reported' | ✅ v4 |
| **evidence_tier** | TEXT | — | ✅ v4 |
| **fact_role** | TEXT | — | ✅ v4 |
| **ecological_layer** | TEXT | — | ✅ v4 |
| **business_time** | TIMESTAMPTZ | — | ✅ v4 |
| **confidence** | NUMERIC(3,2) | — | ✅ v4 |
| created_at | TIMESTAMPTZ | NOW() | |

> **注**：v4 之前 evidenceTier / ecologicalLayer / factRole 在 ExtractedAtom 接口有但 pipeline.ts 构造 AtomRow 时丢弃。v4 已修复映射。

## epistemic_status 枚举与传播权限

| 状态 | 含义 | confidence 上限 | 传播权限 |
|---|---|---|---|
| `observed` | 直接观察到的行为 | 0.9 | 可进 workingHypothesis |
| `reported` | 家长/老师转述 | 0.5（单源） | 可进 dossier，但标来源 |
| `derived` | 多源交叉印证 | 0.8 | 可进 stable mechanism |
| `inferred` | LLM 推断 | 0.3 | **不进** supportingEvidence，只进 alternativeReadings |
| `hypothesized` | 待验证假设 | 0.3 | **只进** pending_hypotheses |
| `expert_confirmed` | 专业人员确认 | 0.95 | 可进 stable mechanism |

**认识论单向流**：observed → reported → derived → inferred → hypothesized（可信度递减）。hypothesized 不得升级为 observed，只能被 ≥2 独立来源印证升级为 derived。

## evidence_tier 枚举

- `behavior`：具体行为（谁做了什么）→ 可上 medium
- `verbatim`：孩子/老师原话 → 可上 high
- `repeated`：明确出现多次 → 可上 high
- `cross_scene`：跨场景一致 → 可上 high
- `outcome_checked`：有结果对照 → 可上 high

单次抱怨、抽象标签 → 留空，下游按 low 处理。

## fact_role 枚举

- `presenting`：主诉现象
- `trigger`：触发点
- `response`：孩子反应
- `counter`：反证（与已有判断相反）
- `context`：背景上下文

## is_high_value 判定规则

`isHighValue=true` 仅限：
- sourceType = child_quote（孩子原话）
- sourceType = material_observation（老师/材料反馈）
- factType = counter_evidence（反证）
- factType = feedback（执行反馈）

普通碎事实 isHighValue=false。

## confidence 硬公式

- 单源 reported 且无交叉印证 → 0.3-0.5
- evidenceTier=repeated（多次出现）→ 0.6-0.7
- evidenceTier=cross_scene（跨场景一致）→ 0.7-0.8
- 多源印证（observed + reported 一致）→ 0.8-0.9
- inferred / hypothesized → ≤0.3

## evidence_episodes 表（11 列）

| 列 | 类型 |
|---|---|
| episode_id | TEXT PK |
| family_id / child_id | TEXT |
| source_event_id | TEXT |
| summary | TEXT |
| parent_interpretation | TEXT |
| missing_info | TEXT[] |
| scene_tags / mechanism_tags | TEXT[] |
| embedding | vector(1024) |
| source_created_at | TIMESTAMPTZ |
| created_at / updated_at | TIMESTAMPTZ |

## 何时写 atom / 何时写 episode

- **episode_ingest job**：每轮有效非寒暄输入触发（route.ts L151-158）
- **批量改造方向**（product-memory-architecture Layer 1）：改为 10 轮 / 登录 / 反证轮批量触发，不每轮深拆
- episode_ingest handler 成功后链式触发 deep_mechanism_review（15min debounce）
