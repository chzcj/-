# Execution Playbook · Family Understanding Dossier

> **目的**：把 spec/tasks 变成「小步可合并、可回滚、可验证」的实施协议，专门应对：
> - 大 diff 一次改对失败（10+ 文件、漏 consumer、改一半）
> - GLM/Agent 顺手多改（voice、HANDOFF、无关重构）
> - 调试闭环不足（typecheck 过了但 Job/前台仍坏）
> - 长上下文一致性（daily → retrieval → digest → job → portrait 后半段打架）

**硬约束**：本 playbook 与 [spec.md](./spec.md) 附录 F（14 条工程规则）、[bff-three-phase-overview.md](../../documents/bff-three-phase-overview.md) 并列生效。

---

## 1. PR 切片原则（Anti-Big-Diff）

### 1.1 单 PR 上限

| 维度 | 上限 | 超出则拆 PR |
|------|------|-------------|
| 业务目标 | **1 个** SubTask | 每个 SubTask 默认独立 PR |
| 改动文件 | **≤5 个**（不含 lock/registry 自动生成） | 按 producer / consumer 拆 |
| 行为变更 | **1 条用户可感知路径** | 例如「只改 hidden payload」不与「改 deep 链」同 PR |
| Feature flag | 新行为 **必须** 在 flag 后 | 默认 `PORTRAIT_V3=0` |

### 1.2 禁止同 PR 混搭

- ❌ Phase B + Phase C
- ❌ 后台 deep 链 + 前台 SP 大改（除非同一 SubTask 且 ≤5 文件）
- ❌ schema 变更 + 删旧字段 consumer
- ❌ deploy + 未 typecheck 的 WIP
- ❌ 任何 [voice 锁定文件](file:///Users/mac/Desktop/育见-2/.cursor/rules/voice-input-locked.mdc) 与 dossier 改动

### 1.3 推荐 PR 序列（严格顺序）

```
PR-0   Task 0 真实数据校验（只读文档，可零代码）
PR-B1  Task 1.1–1.2  PARENT_INPUT 100（2 文件）
PR-B2  Task 2.1–2.2  THEORY cache（2–3 文件）
PR-B3  Task 3.1–3.3  debounce + 日桶只 digest（1–2 文件：queue.ts + s2-flags 注释）
PR-B4  Task 4.1       matchedMechanisms slice 8（2 文件）
PR-C1  Task 5.1–5.3  theory-cards rich（1 文件 + registry 若需）
PR-C2  Task 6.1–6.3  digest schema v2 类型+store（3 文件，**不写** synthesizer）
PR-C3  Task 7.1       portraitSynthesizer SP only（prompt + registry）
PR-C4  Task 7.2–7.4  pipeline flag 分支（1 文件 pipeline.ts）
PR-C5  Task 8.1–8.4  dossier_patch Job（queue + decision-engine + prompt，≤5 文件拆 2 PR）
PR-C6  Task 9         episode 元数据（episode pipeline + SP）
PR-C7  Task 10        digest 投影（digest-builder + pick-deep-model-digest，**同 PR**）
PR-C8  Task 11        dossierSlice（slicer + frontend-read-pack + router，**同 PR**）
PR-D1  Task 12        deep-modeling.md 宪法
PR-D2  Task 13.1–13.3 SP 字段引用（prompt + prose-context）
PR-D3  Task 13.4–13.7 R1/R5/R6（parent-facing-copy + orchestration + prose-section-stream）
PR-D4  Task 14        read-contract + DESIGN.md
PR-D5  Task 15        PORTRAIT_V3 flag 默认关 + 回退路径验收
PR-E   Task 16        全量验证 + deploy（单独 PR/回合，用户明确 deploy 时）
```

**规则**：PR-C7 完成前，**禁止**改 parentFacingStyle 引 dossierSlice（避免前台引用了还不存在的字段）。

---

## 2. Producer → Storage → Consumer 门禁

实施任何字段/层变更前，**必须先填**（可复制 spec 附录 B 一行）：

| 检查项 | 命令/动作 |
|--------|-----------|
| 谁写入 | grep `saveDeepModelDigest` / `portraitSynthesizer` / `dossierPatcher` |
| 谁读取 | grep `loadDeepModelDigest` / `pickDeepModelDigestPack` / `pickFrontendReadPack` / `dossierSlice` |
| 谁投影 | grep `mechanismNarrative` / `integratedSynthesis` / `formatMatchedMechanismCards` |
| 前台 3 处 LLM | `prose-section-stream.ts` / `parent-facing-copy.ts` / `daily-turn-bff.ts` |
| 预演/画像 | `rehearsal/analyze/route.ts` / `profile/hub/route.ts` / `daily-refresh-agent.ts` |
| 契约测试 | `scripts/test-frontend-read-pack.mjs` / `audit-memory-contract.mjs` |

**Merge 前硬规则**：
- 新增 storage 字段 → 同一 PR 或 **紧后一个 PR** 必须有 **≥1 个 consumer** 读取；否则禁止 merge（防 orphan 字段）。
- 改 `DeepModelDigest` 类型 → 同 PR 必须改 `pick-deep-model-digest.ts` + `types/deep-model-digest.ts`。
- 改 `FRONTEND_READ_PACK_KEYS` → 同 PR 必须改 `read-contract.md` + `test-frontend-read-pack.mjs`。

---

## 3. 仓库铁律清单（防 GLM 顺手多改）

每个 PR 开工前 Agent **必读** `.agents/HANDOFF.md` 最新一条；收工按 AGENTS.md，但 **dossier 切片 PR 默认不 deploy**（除非用户本轮明确「部署」）。

| 铁律 | 路径/动作 | dossier PR 默认 |
|------|-----------|-----------------|
| 语音锁定 | `useTencentAsrInput.ts` 等 | **禁止改** |
| sync:gitee | 开工 `npm run sync:gitee` | 必须 |
| Commit | 用户明确要求才 commit | 默认不 commit |
| HANDOFF | 仅 deploy 或用户要求收工时 | Phase B/C 中间 PR 可只更新 spec checklist |
| deploy | typecheck + build + deploy.sh | **仅 PR-E / 用户指令** |
| 小程序 | `DailyStreamEvent` 不变则不必 upload | build:weapp 在 Task 16 |
| Secrets | 不写 HANDOFF/Git | 永远 |

**Scope 声明模板**（每个 PR 描述必填）：

```markdown
Goal: （一个 SubTask）
Non-goals: （列 3 条明确不做的事）
Files touched: （≤5）
Flag: PORTRAIT_V3=0|1
Rollback: （如何一键回退）
```

---

## 4. 调试闭环（每 PR 必跑最小集）

### 4.1 第一轮 · 代码（必跑）

```bash
npm run typecheck
npm run build
# 若改了 read-pack / router / digest：
node scripts/test-frontend-read-pack.mjs
node scripts/audit-memory-contract.mjs
# 若改了 prompt registry：
node scripts/audit-prompt-registry.mjs
```

### 4.2 第二轮 · 产品路径（按 PR 类型选子集）

| PR 类型 | 必验路径 |
|---------|----------|
| Phase B | 本地打一条 daily stream；看 log `[daily/stream] traceId=` |
| Phase C deep | 查 `job_queue` 新 job 的 `job_type` + `idempotency_key` + trace_id |
| Phase C dossierSlice | mock dossier → `pickFrontendReadPack` 含 dossierSlice；无 leak ecologicalCalibration |
| Phase D SP | grep prompt 无 `mechanismNarrative` 硬引用（flag on 分支） |
| flag 回退 | `PORTRAIT_V3=0` 仍走 matchedMechanisms，daily 不 500 |

### 4.3 第三轮 · 系统一致性

- 附录 B 字段表与代码 grep 结果 **一致**
- `shouldReconceptualize` 与 `dossier_patch` **不重复全量**（L1 不改 core，L2 才改）
- 5 路 deep 触发：PR-B3 后日桶 **不再** 默认 4 步 deep（只 digest_update）

### 4.4 可观测性探针（实施后应存在）

| 探针 | 用途 |
|------|------|
| `[cache:json:fast]` / `[stream:timing]` | prompt cache / 首字 |
| `[deep-mechanism] reason=` | 触发源（debounce 后） |
| `traceId` on memory_write + episode_ingest + dossier_patch | 一轮对话追溯 |
| `changeLog` on dossier_v{n} | L1/L2 是否可解释 |

---

## 5. 长上下文一致性（防前后半段打架）

### 5.1 单一真源顺序

```
理论 docx → theory-cards.ts（rich）→ portraitSynthesizer SP → dossier JSON schema
                ↓
         deep_model_digest (schema v2)
                ↓
    digest-builder 投影 → pickDeepModelDigestPack → dossierSlicer
                ↓
         retrievalPack.dossierSlice → buildDailyProsePayload → 3 处 LLM
```

**禁止**：SP 写一套字段名、TypeScript 另一套、read-contract 第三套。改任一层 **同 PR 或文档 PR** 更新附录 B。

### 5.2 Flag 双路径对称

`isPortraitV3Enabled()` 分支必须 **成对**：

| 路径 | V3 on | V3 off |
|------|-------|--------|
| deep 链主 synthesizer | portraitSynthesizer | mechanismSynthesizer |
| digest narrative | integratedSynthesis | topMechanism.description |
| 前台 pack 主字段 | dossierSlice | matchedMechanisms |
| taskTitle | interventionTargets[0] | 现有 LLM taskTitle |

**禁止**：只改 on 路径不改 off → 回退必崩。

### 5.3 BFF 三段式边界（不可破）

- 段① orchestration：**永不**因 dossier 调 LLM
- 段② 组装包：dossierSlice **确定性**切片，不在段②调 portraitSynthesizer
- 段③ 只读切片表达；**方法**来自 interventionTargets（R6），不是段③ 现编机制

见 [bff-three-phase-overview.md](../../documents/bff-three-phase-overview.md)。

---

## 6. Agent 分工建议（GLM vs Composer）

| 工作 | 推荐 | 原因 |
|------|------|------|
| spec/audit/playbook | GLM / 任意 | 你已验证分析强 |
| theory-cards.ts 数据填充 | GLM + **人工 diff** | 易漏字段 |
| pipeline.ts / queue.ts | Composer + playbook | Job 幂等/debounce 易错 |
| SP 长文 | GLM 草稿 → **人工**对齐附录 A 样例 | 术语泄漏 |
| 契约脚本对齐 | Composer | 需跑 mjs |
| deploy | **用户明确指令** | 密码/HANDOFF |

**GLM 开工必附**：本 playbook §1 PR 编号 + §3 Scope 模板 + 附录 B 相关行。

---

## 7. Stop Rule 触发器（必须先问用户）

- 改 `packages/contracts` 或 daily stream NDJSON 形态
- 删除/重命名 `matchedMechanisms` 且无兜底
- 新建 DB 表（spec 已禁止，若动议必问）
- 改 episode_ingest 触发条件（与 memory-write.md 漂移）
- 任何 voice / ASR / RecorderManager 波及
- Task 0 生产库仍不可连且要做「真实家庭验收」

---

## 8. 与 checklist 的关系

- [checklist.md](./checklist.md) 新增 **「Execution Gates」** 节：每个 Phase 结束勾 PR 序列 + 三轮验证。
- 实施者 **每完成一个 PR** 在 checklist 对应项打勾，**禁止**跳 Phase 直接 Task 13。
