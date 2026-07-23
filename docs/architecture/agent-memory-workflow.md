# 育见底层技术架构：Agent · SP · Job · 记忆

> 产品语义见 [`PRODUCT.md`](../../PRODUCT.md) · 设计映射见 [`DESIGN.md`](../../DESIGN.md)  
> 契约真源：`docs/contracts/memory-read.md` · `memory-write.md` · `read-contract.md` · `daily-stream-events.md`  
> SP 源文件：`prompts/**/*.md` → `npm run build` 生成 `src/lib/server/prompts/registry.generated.ts`

---

## 1. 系统总览

```mermaid
flowchart TB
  subgraph Client["客户端"]
    MP["微信小程序 Taro"]
    WEB["Web hi-fi 四 Tab"]
  end

  subgraph BFF["Next.js BFF (yujian.yihe.site)"]
    API["app/api/*"]
    DAILY["daily-turn-bff"]
    ORCH["orchestration/pipeline"]
    RET["retrieval/router"]
    PACK["frontend-read-pack"]
  end

  subgraph Agents["Agent 层 (ark-agents)"]
    FRONT["前台 Agent<br/>prose / section / 预演 / 画像展示"]
    BACK["后台 Agent<br/>证据拆解 / 综合 / 深度机制 / digest"]
  end

  subgraph Memory["PostgreSQL 记忆层"]
    L0["L0 turn_events"]
    L1["L1 daily_updates"]
    EV["entry_evidence_packs"]
    NET["evidence_networks"]
    DIG["deep_model_digest"]
    SNAP["built_profile_snapshots"]
  end

  subgraph Jobs["job_queue (PM2 yujian-jobs)"]
    MW["memory_write"]
    EE["entry_evidence"]
    DMR["deep_mechanism_review"]
    DU["digest_update"]
    MR["model_review"]
  end

  MP --> API
  WEB --> API
  API --> DAILY
  DAILY --> ORCH
  ORCH --> RET
  RET --> Memory
  DAILY --> FRONT
  FRONT --> PACK
  PACK --> Memory
  API --> Jobs
  Jobs --> BACK
  BACK --> Memory
  MW --> DU
  MW --> MR
  MW --> DMR
```

**运行形态**

| 进程 | 端口 | 职责 |
|------|------|------|
| `yujian` (PM2) | 3000 | Next.js Web + API；`CHILDOS_ENABLE_JOB_POLLER=off` |
| `yujian-jobs` (PM2) | 3010 | Job poller；消费 `job_queue` |
| `server.js` | — | 生产入口 + Web ASR WebSocket（讯飞签发） |

---

## 2. SP（System Prompt）分层

SP 不手写进代码，编辑 `prompts/**/*.md` 后由 `scripts/build-prompts.mjs` 编译进 `promptRegistry`。

```mermaid
flowchart LR
  subgraph Core["prompts/core/ · 编入所有家长可见 Agent"]
    PFS["parentFacingStyle<br/>前台角色宪法"]
    DMP["deepModelingParentDigest<br/>深度建模家长向规范"]
    EBS["entryBuildStyle<br/>四模块采集风格"]
  end

  subgraph Front["prompts/front/ · 同步调用 · 面向家长或前台"]
    DDO["dailyDialogueOrchestration<br/>交流 prose"]
    PFC["parentFacingCopy<br/>交流 section 文案"]
    CPR["communicationRehearsal<br/>预演对话"]
    DPR["dailyPortraitRefresh<br/>登录画像 chips"]
    PBS["profileBuildSynthesis<br/>四模块综合"]
    PBD["profileBuildDiagnosis<br/>首版画像诊断"]
    EFU["entry*FollowUp / entry*Summary<br/>模块追问与阶段总结"]
    FPL["familyPlanner<br/>任务规划"]
    WKR["weeklyReview<br/>周报"]
  end

  subgraph Back["prompts/background/ · 后台 / Job 内调用"]
    EEB["entryEvidenceBuilder"]
    MES["multiEntrySynthesis"]
    DDI["deepDiagnosis"]
    DMR_SP["deepMechanismReview"]
    ECOS["ecosystemClassifier"]
    THM["theoryMatcher"]
    MSYN["mechanismSynthesizer"]
    SRE["structuralRiskExtractor"]
    MWR["memoryWrite"]
    MRV["modelReview"]
    DDEC["dailyDecompose"]
    EPI["episodeExtractor"]
    FBU["familyBriefUpdater"]
    BRD["boardUpdater"]
  end

  subgraph Back2["prompts/back/"]
    DDB["deepModelDigestBuilder"]
  end

  Core --> Front
  Core --> Back
  PFS --> DDO
  PFS --> PFC
  DMP --> DDO
  DMP --> CPR
```

### SP 组装规则（Prompt Cache）

| 调用场景 | system（稳定前缀） | user（动态 payload） |
|----------|-------------------|----------------------|
| 交流 prose | `parentFacingStyle` + `dailyDialogueOrchestration` + `deepModelingParentDigest` | `userText` + `retrievalPack` + `deepModelDigest` + `proseMode` |
| 交流 section | `parentFacingStyle` + `parentFacingCopy` + `deepModelingParentDigest` | 同上 + `sectionSkeletons` |
| 预演 analyze | `parentFacingStyle` + `communicationRehearsal` + `deepModelingParentDigest` | `parentText` + digest + retrievalPack |
| 四模块追问 | `entryBuildStyle` + `entry*FollowUp` | 模块 rawText + stage 上下文 |
| 深度机制 Job | `deepMechanismReview` 或链式 4 步 SP | 全量 BackendReadSchema |

实现入口：`src/lib/server/ark-agents.ts`（`callAgentJson` / `requireTextStream`）· `parent-facing-copy.ts`（`combinedProseSystem`）

---

## 3. 记忆读写边界

```mermaid
flowchart TB
  subgraph Write["写入路径"]
    TE["turn_events<br/>每轮 final 同步写"]
    DUW["daily_updates<br/>memory_write job"]
    EEP["entry_evidence_packs<br/>entry_evidence job"]
    ENW["evidence_networks<br/>synthesis / deep_mechanism"]
    DIGW["deep_model_digest<br/>digest-builder + LLM"]
  end

  subgraph ReadFront["前台只读 retrievalPack + digest"]
    EF["entryFacts"]
    MM["matchedMechanisms"]
    CSM["childStructureModels"]
    FP["familyPatterns"]
    PU["parentUnderstanding"]
    RE["recentEvents"]
    CQ["childQuotes"]
    DMD["deepModelDigest"]
  end

  subgraph ReadBack["后台全量读"]
    ALL["entry packs 全量 · networks 全量<br/>hypotheses · cycles · turn 历史"]
  end

  TE --> RE
  EEP --> EF
  ENW --> MM
  SNAP["built_profile_snapshots"] --> CSM
  DIGW --> DMD
  ALL --> ReadBack
  ReadFront --> FRONT_AI["前台 Agent"]
  ReadBack --> BACK_AI["deep_mechanism / synthesis / diagnosis"]
```

**铁律**：前台 Agent **只读不思考**（`pickFrontendReadPack`）；深度推理由后台 Job 写回后再被前台引用。

---

## 4. 交流 `/api/daily/stream` 一轮工作流

```mermaid
sequenceDiagram
  participant U as 家长
  participant API as daily/stream
  participant BFF as daily-turn-bff
  participant OR as orchestration
  participant RET as retrieval/router
  participant LLM as 前台 LLM
  participant PG as PostgreSQL
  participant Q as job_queue

  U->>API: POST text
  API->>BFF: runDailyTurnBff(traceId)

  par 并行
    BFF->>PG: loadDeepModelDigest / buildDeepModelDigest
    BFF->>OR: runOrchestrationPipeline
    OR->>RET: buildDailyDialogueRetrievalPacket
    RET->>PG: 读 10 层记忆
    OR-->>BFF: OrchestrationOutput + routing
  end

  BFF-->>API: thinking chips (NDJSON)
  BFF->>LLM: streamProseAndSections<br/>prose + visible sections
  LLM-->>API: delta / section_* / actions (流式)

  API-->>U: final + traceId
  API->>PG: saveTurnEvent (L0 必写)

  alt 非 safety / insufficient / 短寒暄
    API->>Q: enqueue memory_write
  end
  alt counter_evidence
    API->>Q: enqueue episode_ingest
  end

  Note over Q: 异步：memory_write 链式<br/>digest_update · model_review · deep_mechanism_review
```

### Orchestration（无 LLM 的规则编排）

`src/lib/server/orchestration/pipeline.ts` — **不是**大模型，是 BFF 内 7 步调度：

1. 安全分级 `classifySafetyTier`
2. 检索 `buildDailyDialogueRetrievalPacket`（warmTurn 可走 session cache）
3. 输入分类 / 与已有模型关系（重复模式、反证、新机制…）
4. `routingDecision`：prose 模式、是否追问、frontResponseType
5. `composeDailySections` 骨架（section id / hidden）
6. `composeDailyActions`
7. 输出 `OrchestrationOutput` → 驱动 LLM payload

### 前台 LLM 并行策略

- **合并调用**：prose + visible sections 单次 `streamProseAndSections`（marker 流）
- **hidden sections**：后台第二次 LLM，不阻塞 actions / 输入解锁
- **深度展开**：`POST /api/daily/deep-expand` → `section-llm-enrich` + 可选 `daily_deep` job

---

## 5. Onboarding 四模块建档工作流

```mermaid
flowchart TB
  START["开始 / intro / hub"]
  LOGIN["WechatLoginSheet"]
  CAP["capture 采集<br/>BuildRecordBox + ASR"]
  SUM["entry*Summary<br/>阶段总结 Agent"]
  FU["entry*FollowUp<br/>追问 Agent"]
  EEJ["job: entry_evidence<br/>entryEvidenceBuilder SP"]
  ALL4{"四模块齐?"}
  SYN["profileBuildSynthesis<br/>综合建模"]
  DIA["profileBuildDiagnosis<br/>首版画像"]
  GEN["generating 页等待"]
  DMR["job: deep_mechanism_review<br/>立即触发"]
  DDB["deepModelDigestBuilder"]
  RES["result 首版画像"]
  BASIC["basic 昵称年级<br/>onboardingComplete"]

  START --> LOGIN --> CAP
  CAP --> FU
  FU -->|shouldAsk| CAP
  FU -->|done| SUM
  SUM --> EEJ
  EEJ --> ALL4
  ALL4 -->|否| CAP
  ALL4 -->|是| SYN --> DIA --> GEN
  GEN --> DMR --> DDB
  DMR --> RES --> BASIC
```

| API / 路由 | Agent / Job | 写入 |
|------------|-------------|------|
| `POST /api/entry/analyze` | `entry*FollowUp` / `entry*Summary` | `entry_records`；完成后 `entry_evidence` job |
| `POST /api/synthesis` | `profileBuildSynthesis` | 证据网络草案 → `memory_write` |
| `POST /api/diagnosis` | `profileBuildDiagnosis` | `built_profile_snapshots` → `memory_write` |
| `POST /api/profile/built` | — | 触发 `deep_mechanism_review`（`deep_mechanism:build:` 幂等键，不等日桶） |
| `POST /api/profile/basic` | — | `onboardingComplete`（需已有画像） |

---

## 6. 后台 Job 队列

```mermaid
flowchart TD
  subgraph Triggers["触发源"]
    DS["daily/stream final"]
    EA["entry/analyze 模块完成"]
    BUILD["profile/built 四模块齐"]
    LOGIN["login → forceLoginJobCheck"]
    DEEP["daily/deep-expand"]
  end

  subgraph JobTypes["job_type"]
    MW["memory_write"]
    EPI["episode_ingest"]
    EE["entry_evidence"]
    DMR["deep_mechanism_review"]
    DU["digest_update"]
    MR["model_review"]
    DD["daily_deep"]
    PR["profile_rewrite"]
  end

  DS --> MW
  DS --> EPI
  EA --> EE
  EA --> EPI
  BUILD --> DMR
  DEEP --> DD
  LOGIN --> DU
  LOGIN --> MR
  LOGIN --> PR

  MW --> DU
  MW --> MR
  MW --> DMR
  EE --> DU
  EE --> MR
  DD --> MW
  PR --> DU
```

### Job 说明表

| job_type | Handler | 主要 SP | 日桶 / 幂等 | 写入 |
|----------|---------|---------|-------------|------|
| `memory_write` | `executeWritePlan` | `memoryWrite`（计划 JSON） | per trace | `daily_updates`、叙事模式等 |
| `episode_ingest` | `ingestEpisodeStrict` | `episodeExtractor` | per trace | 向量 episode / fact_atoms |
| `entry_evidence` | `runEntryEvidenceBuild` | `entryEvidenceBuilder` | per module | `entry_evidence_packs` |
| `deep_mechanism_review` | `runDeepMechanismReview` | 见 §7 链 | **日桶** + build 立即键 | `evidence_networks`、假设、叙事、`structuralTensions` |
| `digest_update` | `rebuildBriefAndBoard` | `familyBriefUpdater` + `boardUpdater` | **每租户每天 1 次** | brief / board |
| `model_review` | `runModelReview` | `modelReview` | **每租户每天 1 次** | 假设权重 / 反证 |
| `daily_deep` | `runDailyDeep` → 链式 `memory_write` | `dailyDecompose` | per episode | 六维拆解 + 新假设 |
| `profile_rewrite` | `runProfileRewrite` | 专用 agent | **每 2 天 1 次** | 重写 `built_profile_snapshots` |

队列实现：`src/lib/server/jobs/queue.ts` · 状态：`pending` → `running` → `succeeded` / `failed` / `retrying`

家长可见追溯：`GET /api/daily/memory-status?traceId=` ← 查 `memory_write` / `episode_ingest` 状态

---

## 7. deep_mechanism_review 多 Agent 链

```mermaid
flowchart LR
  IN["全量 BackendReadSchema<br/>packs · turns · network · hypotheses"]
  E1["ecosystemClassifier<br/>五大生态系统分类"]
  E2["theoryMatcher<br/>20 理论卡匹配"]
  E3["mechanismSynthesizer<br/>机制矩阵综合"]
  E4["structuralRiskExtractor<br/>家庭运转张力"]
  OUT["写回记忆"]
  NET["evidence_networks<br/>candidateMechanismMatrix"]
  HYP["pending_hypotheses"]
  PNP["parent_narrative_patterns"]
  DIG["deep_model_digest<br/>structuralTensions"]
  SNAP["built_profile_snapshots.deepMechanism"]

  IN --> E1 --> E2 --> E3 --> E4 --> OUT
  OUT --> NET
  OUT --> HYP
  OUT --> PNP
  OUT --> DIG
  OUT --> SNAP
```

完成后链式：`deepModelDigestBuilder`（`prompts/back/deepModelDigestBuilder.md`）→ 供前台 `mechanismNarrative` / `anchoredFacts` / `childQuotes`。

---

## 8. 其他功能 Agent 路径

```mermaid
flowchart TB
  subgraph Rehearsal["预演"]
    RA["POST /api/rehearsal/analyze"]
    RA --> CPR["communicationRehearsal SP"]
    CPR --> DIG_R["必读 deepModelDigest<br/>childQuotes · interactionLoops"]
  end

  subgraph Tasks["任务"]
    PL["POST /api/planning"]
    PL --> FPL["familyPlanner SP"]
    FPL --> DIG_T["deepModelDigest + observations"]
  end

  subgraph Profile["画像刷新"]
    DR["POST /api/account/daily-refresh"]
    DR --> DPR["dailyPortraitRefresh SP"]
    DPR --> HUB["hub: thinkingChips · portraitCards · refreshedAt"]
  end

  subgraph Portrait["画像展示"]
    HUB_API["GET /api/profile/hub"]
    HUB_API --> PG[("记忆层")]
    HUB_API --> UI["StructuralTensionCard · AuthorityInsightCard"]
  end
```

---

## 9. 小程序 ↔ BFF 对照

| 小程序页面 | BFF API | 前台 Agent | 后台 Job |
|------------|---------|------------|----------|
| `pages/daily` | `/api/daily/stream` | prose + section | `memory_write` |
| `pages/rehearsal` | `/api/rehearsal/analyze` | `communicationRehearsal` | — |
| `pages/tasks` | `/api/planning` | `familyPlanner` | — |
| `pages/profile` | `/api/profile/hub` + `daily-refresh` | `dailyPortraitRefresh` | `digest_update` |
| `packageOnboarding/capture` | `/api/entry/analyze` | `entry*FollowUp/Summary` | `entry_evidence` |
| `generating` | `/api/profile/built` + job 状态 | — | `deep_mechanism_review` |

---

## 10. 验证与审计

```bash
npm run audit:fullchain       # 推荐：test:contracts + audit-prompt-registry
npm run test:contracts        # 流式 + FrontendReadSchema + memory-contract
node scripts/audit-prompt-registry.mjs
node scripts/audit-memory-contract.mjs
node scripts/test-retrieval-packet.mjs
npm run audit:memory            # 可选：线上 DB 召回探测
```

收工清单：[docs/contracts/FULLCHAIN-SELF-CHECK.md](../docs/contracts/FULLCHAIN-SELF-CHECK.md)

---

## 相关文件索引

| 领域 | 路径 |
|------|------|
| 交流 BFF | `src/lib/server/daily/daily-turn-bff.ts` |
| 调度编排 | `src/lib/server/orchestration/pipeline.ts` |
| 检索打包 | `src/lib/server/memory/retrieval/router.ts` |
| 前台读包 | `src/lib/server/daily/frontend-read-pack.ts` |
| Prose 上下文 | `src/lib/server/daily/prose-context.ts` |
| Job 队列 | `src/lib/server/jobs/queue.ts` |
| 深度机制 | `src/lib/server/memory/deep-mechanism/reviewer.ts` · `pipeline.ts` |
| Digest | `src/lib/server/memory/deep-modeling/digest-builder.ts` |
| SP 注册表 | `src/lib/server/prompts/registry.generated.ts` |
| PM2 | `ecosystem.config.js` |
