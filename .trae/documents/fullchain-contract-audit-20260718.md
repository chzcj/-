# 全链路契约审计报告 · 2026-07-18

**范围**：prose/BFF 近期改动 + dossier v3 读包链 + 跨端契约  
**执行人**：Cursor Agent（计划「全链路契约自检」）

---

## 1. 自动化套件

| 检查 | 命令 | 结果 | 备注 |
|------|------|------|------|
| Typecheck + registry 同步 | `npm run typecheck` | **PASS** | build-prompts 47 keys |
| Daily 流契约 | test-daily-contract.mjs | **PASS** | 22/22 |
| Stream client | test-daily-stream-client.mjs | **PASS** | 7/7 |
| FrontendReadSchema | test-frontend-read-pack.mjs | **PASS** | 38/38 |
| 条件画像读取 | verify-conditional-profile-reads.mjs | **PASS** | 10/10 |
| Retrieval packet | test-retrieval-packet.mjs | **PASS** | 14/14 |
| 记忆读写契约 | audit-memory-contract.mjs | **PASS** | E1–E7 |
| Deep-model 真库 | audit-deep-modeling-pipeline.mjs | **SKIP** | 本机无 DATABASE_URL |
| Prompt registry | audit-prompt-registry.mjs | **PASS** | 47 keys，必需 key 齐全 |

**修复**：`audit-deep-modeling-pipeline.mjs` 在无 `DATABASE_URL` 时改为 exit 0 + SKIP 警告（原 exit 1 导致 `test:contracts` 误红）。

---

## 2. Prose 电路 trace（producer → consumer）

| 字段 | Producer | Storage | Consumer | UI 可见 |
|------|----------|---------|----------|---------|
| `retrievalPack.*` | `pickFrontendReadPack(ctx)` ← router | 无持久化（每轮组装） | prose/section LLM task JSON | 否 |
| `packStats` | `buildPackStats` in prose-context | — | LLM task + 调试 warn | 否 |
| `proseMode` | `resolveProseRouting` | — | `clampProse` + task 字数 | 否 |
| `proseModeReason` | `resolveProseRouting` | — | payload（routing only） | 否 |
| `writingRules.*` | `buildDailyProsePayload` | — | LLM 软约束 | 否 |
| `turnRelevantSnippets` | `pickTurnRelevantSnippets` | — | LLM 切入提示 | 否 |
| `deepModelDigest` | `ensureDigestPack` ← digest 层 | `memory_layer_items.deep_model_digest` | prose + safety 路径 | 否 |
| `packReadingGuide` | 常量 `PACK_FIELD_GUIDE` | — | LLM | 否 |
| `visibleReply` | BFF `clampProse` | turn_events（异步） | NDJSON → Web/MP | **是** |
| sections / actions | section-composer + parentFacingCopy | turn_events | NDJSON | **是** |

**红线 grep**：
- `preferDefiniteSummary`：**无残留** ✓
- `combinedDailyProseSystem`：线上 [`parent-facing-copy.ts`](../src/lib/server/daily/parent-facing-copy.ts) 与 CLI [`scripts/lib/combined-daily-prose-system.mjs`](../scripts/lib/combined-daily-prose-system.mjs) 拼接一致（parentFacingStyle + deepModelingParentDigest + dailyDialogueOrchestration）✓
- replay/sample/trial 脚本均 import 共享 helper，非独立拼接逻辑 ✓
- `BACKEND_ONLY_CONTEXT_FIELDS`（`recentDiagnosis`）不在 `retrievalPack` 内 ✓

---

## 3. Dossier / digest / read-pack 链

```
portraitSynthesizer (PORTRAIT_V3) / dossierPatcher (memory_write 链尾)
  → deep_model_digest.dossier (schema v2)
  → digest-builder 投影 mechanismNarrative / structuralTensions
  → pickDeepModelDigestPack → ensureDigestPack → buildDailyProsePayload
  → dossier-slicer.sliceForDaily(query) → router dossierSliceLines
  → pickFrontendReadPack.dossierSlice → prose LLM
```

| 检查项（cursor-sp-review-checklist 风险 3/5） | 结果 |
|---------------------------------------------|------|
| dossierSlice 在 FRONTEND_READ_PACK_KEYS | ✓ |
| router 填充 dossierSlice | ✓ `router.ts:244-255` |
| digest-builder 从 dossier 投影（非仅 topMechanism） | ✓ v3 flag 开时 |
| portraitSynthesizer 失败回退 mechanismSynthesizer | ✓ pipeline.ts |
| dossierPatcher 收 previousDossier + newFacts | ✓ dossier-patcher.ts |
| matchedMechanisms 兜底 ≤8（helper 过滤 low） | ✓ test-retrieval-packet |

**待环境验证（非 P0）**：PORTRAIT_V3=1 真库附录 A 验收（HANDOFF 已记 DBA 阻塞）。

---

## 4. 跨端契约

- **NDJSON 事件**：`packages/contracts/src/daily-stream.ts` 与 BFF 一致；prose payload **不**进入流式事件 ✓
- **CONTRACT-ALIGNMENT-AUDIT.md（2026-07-11）**：主流程结论仍有效；本轮补充 prose meta 字段文档化（见 read-contract.md 新节）

---

## 5. P0 修复项

| 项 | 动作 | 状态 |
|----|------|------|
| test:contracts 无 DB 误失败 | audit-deep-modeling skip exit 0 | **已修** |
| read-contract 缺 prose meta | 新增「Prose Payload 元字段」节 | **已修** |
| 无收工门禁规则 | 新增 fullchain-contract-check.mdc + FULLCHAIN-SELF-CHECK.md | **已修** |
| 无一键命令 | `npm run audit:fullchain` | **已修** |

**无新发现**：registry 不同步、字段 orphan、NDJSON 泄漏、双份 system 拼接漂移。

---

## 6. 收工命令（固化后）

```bash
npm run audit:fullchain   # test:contracts + audit-prompt-registry
# 有 DATABASE_URL 时可选：
node scripts/audit-deep-modeling-pipeline.mjs [phone]
```
