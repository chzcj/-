# Agent 协作留言板

Cursor、Trae、Codex 收工前各追加一条；开工前运行 `npm run sync:gitee` 阅读最新记录。

格式：

```markdown
## YYYY-MM-DD HH:mm | Agent名 | 范围/分支

**做了什么**
- ...

**为什么**
- ...

**验证**
- ...

**下一步**
- 给其他 Agent 的交接说明

**风险/冲突**
- 别动哪些文件 / 已知问题
```

---
## 2026-06-12 | Codex | backend-pipeline-repair

**做了什么**
- synthesis/route.ts：`buildEntryPack()` 新增 `classifyFacts()` + 接收 `aiFacts`/`aiHypotheses` 填入 `decomposedInput`，修复了之前 AI 分析结果被全扔的 bug
- synthesis/pipeline.ts：从纯硬编码关键词匹配改为调用 AI（`callFastJson` + `agentPrompts.multiEntrySynthesis`），fallback 保留硬编码
- diagnosis/pipeline.ts：同样替换硬编码为 AI 调用（`callFastJson` + `agentPrompts.deepDiagnosis`），加了 `normalizeStringArray`/`normalizeMechanismChain` 字段归一化
- diagnosis/route.ts：从 body 接收 `synthesisOutput`/`maturityLevel`/`childQuotes`/`parentQuotes`/`pendingHypotheses`，不再只依赖空 retrievalPacket
- rehearsal/analyze/route.ts：新增 `profileContext` 可选参数 → profile-aware 预演路径
- synthesis/pipeline.ts + diagnosis/pipeline.ts：加了 `asStringArray`/`firstString`/`normalizeStrength` 字段兼容，AI 返回的 `0.85` → `high`、字段名多样→统一
- memory/database-manager.ts：10 层记忆改成 PostgreSQL 持久化，PM2 重启不丢数据
- nginx `proxy_read_timeout` 60s→300s

**为什么**
- synthesis 和 diagnosis 从来没有调用过 AI，是纯代码关键词匹配+模板
- `entryMap`→`buildEntryPack()` 时把 AI 分析出的 facts/hypotheses 全扔了
- rehearsal 完全不读画像，只靠一句 parentText 丢给 AI
- 修复后测试从 15/25 → 23/25 → profile-rehearsal 8/8 通过

**验证**
- `xiaoyin_five_entry_simulation_v3`：23/25（DeepDiagnosis 5/5、Memory 5/5）
- `xiaoyin-profile-rehearsal`：8/8 passed、avgScore 36/40
- 服务器 readiness：`ready:true` `cookieSecure:true` `mockMode:false` `memoryLayerItems:65+`
- PM2 yujian + asr-proxy 在线

**下一步**
- Trae：本地有大量未提交改动（~60 个文件），需要与负责人确认哪些属于本会话、哪些是旧改动后统一 commit
- 安装了两个 MCP（spec-kit-mcp 缺 ARM 二进制需 cargo，sequential-thinking 可用），`.mcp.json` 已建
- synthesis AI 调用偶有超时，deepseek-chat 处理 5 入口综合 prompt 需 60-90s；prod 上线前建议改成异步队列模式

**风险/冲突**
- `.env.local` 模型已改回 `deepseek-chat`，不要切 v4-pro（太慢）
- 未推 Gitee，本地 git diff 很大

---

## 2026-06-12 | Codex | rehearsal-profile-aware-fix

**做了什么**
- 修复 `/api/rehearsal/analyze` profile-aware 分支：AI 返回字段不完整时不再掉回 blind，而是做归一化补齐
- 兜底基于条件化画像+保护策略+互动循环生成输出
- prompt 精简+字段补全

**验证**
- profile-rehearsal 测试：awarePassed 8/8、avgScore 36/40（之前 0/8、10/40）

**风险/冲突**
- 未推 Gitee

---

## 2026-06-12 | Cursor | gitee-collaboration-ship

**做了什么**
- 落地 `npm run sync:gitee`、`.agents/ONBOARDING-CODEX.md`、`.agents/ONBOARDING-TRAE.md`
- 新增 `AGENTS.md`、`.cursor/rules/gitee-collaboration.mdc`
- README 补充 Gitee 仓库与多 Agent 协作说明

**为什么**
- Trae/Codex 开工前能扫远程变化 + 读 HANDOFF

**验证**
- `node .agents/scripts/sync-gitee.mjs` 可 fetch 并打印 HANDOFF

**下一步**
- Trae/Codex 把 ONBOARDING 文档里的指令贴进各自项目说明
- 三方收工后 push `master`

**风险/冲突**
- 仓库仍有大量本地未提交功能改动，与本 commit 无关

## 2026-06-12 | Cursor | collaboration-bootstrap

**做了什么**
- 新增 Gitee 协作机制：`npm run sync:gitee`、本文件、`AGENTS.md`、`.cursor/rules/gitee-collaboration.mdc`

**为什么**
- Cursor / Trae / Codex 三方协作需要统一「开工前看远程、收工后留言」

**验证**
- `node .agents/scripts/sync-gitee.mjs` 可输出远程提交与 HANDOFF

**下一步**
- 任一 Agent 开始任务前先 `npm run sync:gitee`
- 收工后在此追加一条并 `git push origin master`

**风险/冲突**
- 本地有大量未提交改动，push 前请与负责人确认范围
