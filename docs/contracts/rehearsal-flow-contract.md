# 预演全链路契约（L1–L4 + 对话分析）

> 2026-07-21 | 定稿 UI：**L3 对话分析 V2-F** | mock：`.design_library/.../l3-v2-f-steps.html`

## 屏级映射

| 屏 | 路由 / 页 | 主要 API | Agent |
|----|-----------|----------|-------|
| L1 选场景 | MP `pages/rehearsal` entry · Web `/rehearsal` | `GET /api/rehearsal/scenes` | scene-pain-ranker + rehearsalSceneHydrator |
| L2 场景摘要 | confirm step | `POST /api/rehearsal/brief` | rehearsalSceneBrief |
| L3 模拟预演 | active step | `POST /api/rehearsal/analyze` (stream) | communicationRehearsal |
| L4 结束 | end step | analyze final | communicationRehearsal · `getRehearsalEndCopy` |

L4 结束页仅展示：`closingAdvice` / `childLikelyHearing` / `saferVersion` / 档案说明；**不展示** `likelyTriggeredMechanisms` / `usedProfileEvidence`（内部字段）。
任务保存使用 `pickRehearsalTaskTitle`（≥8 字准入）。
| 亲子录音 | MP `dialogue/index` | `POST /api/rehearsal/dialogue-transcribe` | ASR + dialogueAnalysisV2 |
| 对话分析 | MP `dialogue-result` · Web `/rehearsal/dialogue-result` | `GET /api/rehearsal/dialogue-analyze?id=` | dialogueAnalysisV2 |
| 上次分析 | L1 resume 卡 | `GET /api/rehearsal/dialogue-analyze/latest` | — |

## L1 · scenes

| UI 字段 | Producer | Storage | Consumer |
|---------|----------|---------|----------|
| `scenes[].title/lede/summary` | ranker + hydrator | 无（90s 客户端缓存） | scene-card |
| `mentionCountHint` | **代码** rankPainClusters | — | scene-tag |
| `rankedFromDialogue` | BFF boolean | — | section-head-meta |

缓存：`childos_rehearsal_scenes_cache_v1`（MP storage / Web sessionStorage）

## L2 · brief

| UI 字段 | Producer | Consumer |
|---------|----------|----------|
| `sceneSituation` | rehearsalSceneBrief | info-card 场景摘要 |
| `understandingBullets[3]` | rehearsalSceneBrief | insight-list |
| `openingHint` | rehearsalSceneBrief | L3 child-insight 预填 |
| `openingChild` | rehearsalSceneBrief | L3 首条孩子气泡 |
| `openingHintTitle` | rehearsalSceneBrief | L3 hint 标题 |
| `initialStatusText` | rehearsalSceneBrief | L3 状态行（session 持久化） |

## L3 对话分析 V2-F

| UI 块 | JSON 字段 | Producer |
|-------|-----------|----------|
| meta pills | `v2.meta` + `summary` | dialogueAnalysisV2 |
| dossier 2×2 | `v2.dossierCells[]` | dialogueAnalysisV2 |
| 讲清 | `v2.synthesis` | dialogueAnalysisV2 |
| 节奏地图 | `v2.phases[]` | dialogueAnalysisV2；clamp 2–5 段、≤10 句 |
| 今晚可试 | `v2.tryTonightSteps[]` | dialogueAnalysisV2 |
| 示范开口 | `v2.sampleScene` + `v2.sampleLines[]` | dialogueAnalysisV2 |

持久化：`dialogue_analyses.rehearsal_seed.v2`（JSONB）；兼容字段 `analysis`=`synthesis`，`tryTonight`/`sampleDialogue` 由 steps/lines 序列化。

旧记录无 `v2`：BFF `enrichDialogueAnalysisRow` 从 `segments` 适配节奏段。

**批量升级 v2**（可选，有 LLM 成本）：

```bash
npm run batch:dialogue-reanalyze -- f_demo c_demo --dry-run
npm run batch:dialogue-reanalyze -- f_demo c_demo --limit=5
```

内部 API：`POST /api/internal/dialogue-reanalyze`（Bearer `INTERNAL_API_TOKEN`）；从 `segments` 还原 transcript 后重跑 `dialogueAnalysisV2`，覆盖同一 `analysis_id`。

## 预演 handoff

| Key | Writer | Reader |
|-----|--------|--------|
| `childos_rehearsal_dialogue_context` | dialogue-result CTA | rehearsal/index applySceneSeed |
| `childos_rehearsal_handoff` | DailyAiMessage | rehearsal/index |
| `childos_last_dialogue_analysis_id` | dialogue 上传 / result GET | L1 resume 卡 |

## 空转 / 红线

- 禁止 LLM 编造 mentionCountHint
- 禁止全量 transcript 进家长 UI（仅 phases 精选）
- 内部 digest 机制名不得进 `v2` 家长字段
- `da_` 前缀校验后才导航 result 页
