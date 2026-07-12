# BFF · 前端 · 后端 · Agent 工作流契约对齐审计

**日期**：2026-07-11  
**范围**：Web hi-fi 四 Tab、微信小程序、Next BFF（59 routes）、Agent 管线

---

## 1. 执行摘要

| 维度 | 状态 | 说明 |
|------|------|------|
| API 信封 `ApiResult<T>` | ✅ 对齐 | BFF `ok/fail` ↔ 小程序 `apiRequest` ↔ Web `api-client` |
| Daily NDJSON 流 | ✅ 对齐 | 事件类型一致；小程序用 `@yujian/contracts` 解析 |
| 画像生成 synthesis→diagnosis→built | ✅ 对齐 | 请求/响应字段匹配 |
| 任务 CRUD + 反馈 | ✅ 对齐 | `taskId`↔`id` 映射；反馈 **POST**（非 PUT） |
| Entry analyze | ⚠️ 小差异 | 小程序多传 `appendMode`；Web 未传（服务端支持） |
| 类型系统 | ⚠️ 三套并行 | `packages/contracts` / `src/types/*` / 小程序本地副本 |
| 契约测试 | ✅ 已修复 | `test-retrieval-packet.mjs` 与 read-contract 同步 |
| Agent 后台 job | ⚠️ 软超时 | readiness/deep-model 轮询超时后继续，不硬阻塞 |

**结论**：主流程（登录 → onboarding → 四 Tab → 流式交流/预演/任务/画像）**无已知字段级罢工**；风险集中在类型漂移、job 失败时的「空数据继续」、以及 Web 部分页面未 typed fetch。

---

## 2. 契约来源（三层）

```
docs/contracts/*.md          ← 设计文档（read-contract、daily-stream-events）
src/types/*                  ← Web + BFF + Agent 运行时 TS
packages/contracts           ← 小程序 path alias（daily + ApiResult + AuthUser）
miniprogram/src/lib/*        ← 预演流等本地副本（对齐 src/types/rehearsal-stream.ts）
```

**建议（非阻断）**：Web 通过 tsconfig paths 引用 `@yujian/contracts`，或 build 时从 `src/types` 生成 contracts 包，消除双份维护。

---

## 3. 主工作流端到端对齐

### 3.1 身份 · Auth

| 步骤 | 客户端 | BFF | 字段 |
|------|--------|-----|------|
| 微信登录 | 小程序 `POST /api/auth/wechat` `{ code }` | `loginWithWechatCode` | → `{ user, sessionToken, isNewUser }` |
| 会话 | Bearer token | `verifyAppApi` | cookie **或** Authorization |
| 当前用户 | `GET /api/auth/me` | `{ user \| null }` | `AuthUser` 含 `onboardingComplete` |

**曾漂移（已修）**：`src/types/childos.ts` 的 `AuthUser` 缺 `onboardingComplete` → 已补齐。

**罢工风险**：无。登录失败有明确 error code；小程序 navigation 依赖 `onboardingComplete` 与 contracts 一致。

---

### 3.2 首次建模 · Entry → Synthesis → Diagnosis → Built

```
capture/follow-up ──POST /api/entry/analyze──► entry-analyze Agent
       │ stage=entry → EntryFollowUpResult { shouldAsk, purpose, directions, voicePrompt }
       │ stage=summary → { mainJudgment, facts, pendingHypotheses, note }
       ▼
generating ──POST /api/synthesis──► { synthesis: SynthesisOutput }
       ──POST /api/diagnosis──► { diagnosis: DiagnosisOutput }
       ──POST /api/profile/built──► { saved, onboardingComplete? }
       ──GET  /api/profile/readiness──► { ready, familyModel, brief, board }
       ──GET  /api/profile/deep-model-status──► { mechanismReviewReady, ... }
```

| 请求体 | 小程序 | Web generating | BFF |
|--------|--------|----------------|-----|
| synthesis | `entryMap`, `crossCuttingSupplement`, `maturityLevel` | 同左 | ✅ |
| diagnosis | `taskType: 'profile_build'`, `synthesisOutput` | 同左 | ✅（已加入 `DiagnosisTaskType`） |
| built | `{ snapshot: BuiltSnapshotInput }` | 同结构 | ✅ |

**曾漂移（已修）**：`profile_build` 不在 `DiagnosisTaskType` 枚举 → 已加入（Web/小程序/script 均使用）。

**软超时（非罢工）**：
- `waitForProfileReadiness`：16×2.5s 后 **仍继续** → hub 可能暂缺 brief/board
- `waitForDeepModelDigest`：36×2.5s 后 **仍继续** → 机制叙事可能未就绪，daily 仍可用 entryFacts

**Job 链**：entry summary → `episode_ingest` + `entry_evidence`；final → `deep_mechanism_review`。失败时 generating 页显示 error，**不会 infinite loading**。

---

### 3.3 日常交流 · Daily Stream

**请求** `POST /api/daily/stream`：

```json
{ "text", "warmTurn?", "recentSectionIds?", "maturityLevel?" }
```

**响应**：NDJSON 行事件（见 `docs/contracts/daily-stream-events.md`）

| 事件 | BFF emitter | Web parser | 小程序 parser |
|------|-------------|------------|---------------|
| start/thinking/delta/prose_complete | ✅ | ✅ | ✅ |
| section_* / sections_complete / actions | ✅ | ✅ | ✅ |
| final { text, sections, actions, linkedAreas?, cards?, traceId, runtime?, timing? } | ✅ | ✅ | ✅（忽略 runtime/timing） |
| error | ✅ | ✅ | ✅ |

**输入锁**：小程序 `runTurn` 有 `try/finally` → `inputReady/sending` 必复位。**不会**因流异常永久锁输入。

**曾漂移（已修）**：`DailyTurn` 缺 `linkedAreas`（thread 恢复时有值）→ 小程序类型已补。

---

### 3.4 预演 · Rehearsal

| 路径 | 传输 | 关键字段 |
|------|------|----------|
| `POST /api/rehearsal/analyze` | NDJSON 或 JSON fallback | `parentText`, `parentRoundCount`, `fromSpecialFeature` |
| `POST /api/rehearsal/dialogue-analyze` | JSON | `{ transcript }` → `{ segments, analysis, tryTonight, ... }` |
| `POST /api/rehearsal/dialogue-transcribe` | multipart | 录音文件 |

小程序 `rehearsalAnalyze.ts` 事件类型与 `src/types/rehearsal-stream.ts` **一致**（本地副本）。

---

### 3.5 任务 · Tasks

| 操作 | 方法 | Body | 响应 |
|------|------|------|------|
| 列表 | GET `/api/tasks` | — | `{ tasks: [{ taskId, title, ... }] }` |
| 创建 | POST | `{ title, source?, sourceTraceId? }` | `{ task }` |
| 反馈 | POST `/:id/feedback` | `{ feedback, status }` | `{ task }` |

小程序 `mapServerTask`: `taskId` → `id`。✅ 对齐。

---

### 3.6 画像 Tab · Hub / Snapshot

| API | 小程序消费字段 | BFF 产出 |
|-----|----------------|----------|
| GET `/api/profile/hub` | `thinkingChips`, `portraitCards`, `coreJudgment`, `structuralTensions` | ✅ |
| GET `/api/profile/snapshot` | `currentFocus`, `recentChanges` | ✅ |
| GET `/api/profile/weekly-review` | `weeklySummary` | ✅ |

**命名陷阱**：`/api/profile/readiness`（建模三件套）≠ `/api/readiness`（DB/FastAI 基础设施）。

---

### 3.7 账号同步 · Account State

| 方向 | Body | Schema |
|------|------|--------|
| GET/POST `/api/account/state` | `{ dailyThread?, storage? }` | Zod `accountBackupBodySchema` |

`dailyThread` 支持 `linkedAreas`, `sections`, `actions`；小程序 `childos.storage.v1` 与 Web 结构兼容（`.passthrough()` 容忍字段名差异如 `id` vs `familyId`）。

---

## 4. Agent 读取契约（FrontendRead vs BackendRead）

实现：`src/lib/server/daily/frontend-read-pack.ts` + `docs/contracts/read-contract.md`

| 字段 | 前端 AI（daily prose/section） | 后端 Agent（deep_mechanism/synthesis） |
|------|-------------------------------|----------------------------------------|
| entryFacts | ✅ string[] slice 6 | 全量 decomposedInput |
| matchedMechanisms | ✅ 机制名 slice 3 | 全量 candidateMechanismMatrix |
| childQuotes | ✅ slice 4（动态） | turn_events 全量 |
| parent_narrative | parentUnderstanding slice | saveParentNarrativePattern 写回 |

**契约测试**：`npm run test:contracts` — daily/stream/frontend-read-pack/conditional-profile 全通过。

---

## 5. 已知差异 · 不会罢工 · 建议跟进

| ID | 问题 | 影响 | 建议 |
|----|------|------|------|
| C-01 | Web hi-fi 页 raw `fetch` 无 `ApiResult` 泛型 | 编译期漏检 | 逐步改用 `api-client` 或 shared fetch |
| C-02 | `@yujian/contracts` 与 `src/types` 双份 | 新增事件需改两处 | 单包或 codegen |
| C-03 | Web entryAnalyze 不传 `appendMode` | 追加录入场景 Web 行为略异 | Web 对齐小程序 |
| C-04 | 小程序 `DailyTurn` 无 `cards` | UI 不展示 cards（Web 有） | 按需移植 DailyCards UI |
| C-05 | jobHealthy=false | 不影响小程序主流程 | 清理 failed jobs 或修 job worker |
| C-06 | ASR 双通道 | Web WS proxy vs 小程序 token+腾讯 | 平台差异，非契约 bug |

---

## 6. 罢工场景排查表

| 现象 | 最可能原因 | 契约/字段 |
|------|------------|-----------|
| 交流发送后输入永久灰 | 流异常未 finally | **已修**（daily runTurn finally） |
| 画像 generating 卡死 | synthesis/diagnosis 5xx | 有 error 态，非 silent stall |
| generating 完成但 hub 空 | readiness 超时 + job 未跑完 | 软超时，非字段错 |
| 按住说话无反应 | 隐私/麦克风/socket | 非 BFF JSON 契约 |
| 任务反馈不保存 | 误用 PUT | 应为 **POST** `/feedback` |
| 预演无 NDJSON | 真机 chunked 不支持 | fallback JSON body 路径存在 |
| 登录后跳错页 | onboardingComplete | AuthUser 已对齐 |

---

## 7. 验证命令

```bash
# 全契约（含 daily/stream/read-pack/memory）
npm run test:contracts

# 小程序发布
cd miniprogram && npm run release-check

# BFF 基础设施（与小程序无关）
node miniprogram/scripts/health-check.mjs
curl -s https://yujian.yihe.site/api/readiness
```

---

## 8. 本次审计修复

1. `scripts/test-retrieval-packet.mjs` — childQuotes 为合法 FrontendRead 字段；deep_mechanism 写路径改为 pipeline.ts
2. `DiagnosisTaskType` 增加 `profile_build`
3. `src/types/childos.ts` — `AuthUser.onboardingComplete` + 必填 `isAdmin`
4. `miniprogram DailyTurn` — 增加 `linkedAreas?`
5. `@yujian/contracts` — `final` 事件增加 `runtime?` / `timing?`
