# Agent / 契约 / BFF 全链路自检（必跑）

改任何 Agent SP、BFF 字段、记忆读写或契约后，**先跑本清单，再声称完成**。

原则层：[ai-product-engineering.mdc](../../.cursor/rules/ai-product-engineering.mdc)  
收工门禁：[fullchain-contract-check.mdc](../../.cursor/rules/fullchain-contract-check.mdc)  
电路地图：[bff-three-phase-overview.md](../../.trae/documents/bff-three-phase-overview.md)

---

## Step 1 — 电路定位

确认改动落在哪一段：

| 段 | 做什么 | 典型文件 |
|----|--------|----------|
| 段① 规则编排 | 安全/路由/section 骨架，**无 LLM** | `orchestration/pipeline.ts`, `section-composer.ts` |
| 段② 厚包组装 | DB → retrievalPack / digest / prose payload，**无 LLM** | `retrieval/router.ts`, `frontend-read-pack.ts`, `prose-context.ts` |
| 段③ LLM 表达 | prose + section stream | `daily-turn-bff.ts`, `parent-facing-copy.ts`, `registry.generated.ts` |
| Job 链 | 异步写回记忆层 | `jobs/queue.ts`, `memory/*/pipeline.ts` |

---

## Step 2 — 字段流转表（改前/改后必填）

对每个新增或变更字段填一行：

| 字段 | Producer | Storage | Consumer | UI 可见？ |
|------|----------|---------|----------|-----------|
| 例：`dossierSlice` | `router` + dossier-slicer | 无（每轮切片） | prose/section LLM | 否 |
| 例：`visibleReply` | BFF clampProse | turn_events | NDJSON → Web/MP | **是** |

**禁止**：只有 producer 没有 consumer；只有 consumer 没有 write 路径。

契约真源：[read-contract.md](./read-contract.md)

---

## Step 3 — P0 红线

**任一项失败 = 未完成，不得开新功能**

- [ ] 每个变更字段有明确 producer **和** consumer
- [ ] 内部字段不进 NDJSON（对照 `BACKEND_ONLY_CONTEXT_FIELDS`）
- [ ] 家长可见文案无理论名/机制卡 ID（dossier v3 理论隐身）
- [ ] `npm run pretypecheck` 后 registry 与 `prompts/` 同步
- [ ] `combinedDailyProseSystem` 与 `scripts/lib/combined-daily-prose-system.mjs` 一致
- [ ] Job/Agent 空输出不覆盖有效状态
- [ ] 跨端：`packages/contracts` 与 BFF NDJSON 形态一致（若动流式事件）

---

## Step 4 — 自动化命令

```bash
npm run sync:gitee              # 开工：远程 + HANDOFF
npm run typecheck               # 含 build-prompts
npm run audit:fullchain         # test:contracts + audit-prompt-registry
```

`test:contracts` 内含：

- test-daily-contract.mjs
- test-daily-stream-client.mjs
- test-frontend-read-pack.mjs
- verify-conditional-profile-reads.mjs
- test-retrieval-packet.mjs
- audit-memory-contract.mjs
- audit-deep-modeling-pipeline.mjs（无 DATABASE_URL 时 SKIP）

**域专项（touch 则跑）**：

```bash
npm run audit:memory-contract
node scripts/test-retrieval-packet.mjs
node scripts/audit-deep-modeling-pipeline.mjs [phone]   # 需 DATABASE_URL
node scripts/audit-prompt-registry.mjs --ping         # 可选生产 smoke
```

---

## Step 5 — Agent 专项

### 前台 Agent（家长可见）

- 只读 `FrontendReadSchema` + `deepModelDigest`（见 read-contract.md）
- prose payload 元字段（packStats、proseMode 等）**不进 UI**
- SP 深度：`.trae/documents/sp-chain-depth-spec.md` + `.cursor/rules/sp-content-depth.mdc`

### 后台 Agent

- 读 BackendReadSchema（全量层）
- 产出写回对应 memory_layer；查 share-layer 策略（read-contract §share-layer）
- dossier v3：portraitSynthesizer / dossierPatcher → `deep_model_digest.dossier` → digest 投影 → dossierSlice

### SP 深度审查（可选 Trae 复核）

附录：[cursor-sp-review-checklist.md](../../.trae/documents/cursor-sp-review-checklist.md)（25 项）

---

## Step 6 — 跨端（Web + 小程序）

若改动涉及 API 响应或流式事件：

- [ ] `docs/contracts/daily-stream-events.md` 与实现一致
- [ ] `packages/contracts/src/daily-stream.ts` 与 `src/types/*` 对齐
- [ ] [CONTRACT-ALIGNMENT-AUDIT.md](./CONTRACT-ALIGNMENT-AUDIT.md) 更新日期与结论

小程序 Porting 自检另见：[PORTING-SELF-CHECK.md](../../miniprogram/docs/PORTING-SELF-CHECK.md)（UI 专项，不替代本文）。

---

## Step 7 — 自检报告模板

```markdown
## 全链路契约自检 · YYYY-MM-DD

**改动摘要**：（1–3 句）

### 字段 trace
| 字段 | Producer | Consumer | UI | ✓/✗ |

### 自动化
| 命令 | 结果 |
|------|------|
| npm run audit:fullchain | PASS/FAIL |
| （域专项） | PASS/SKIP/FAIL |

### P0
- [ ] 全部通过 / 失败项：…

### 文档
- [ ] read-contract / CONTRACT-ALIGNMENT 已更新（若适用）

### 结论
- [ ] 可收工 / 须先修 P0：…
```

报告存放：`.trae/documents/fullchain-contract-audit-YYYYMMDD.md` 或 HANDOFF 摘要。

---

## 附录 A — 短版督促（5 条）

1. 改 Agent 前先画 producer→consumer，不要先改代码再补文档。
2. 收工必跑 `npm run audit:fullchain`。
3. FrontendReadSchema 变了必更 read-contract.md。
4. SP 改了必 pretypecheck（registry 同步）。
5. 无 Step 7 报告 = 未完成。
