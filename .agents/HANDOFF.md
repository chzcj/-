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
## 2026-07-04 02:52 | Cursor | 全面自检：真实调用验证 + 4 处隐患修复

**做了什么（修复"看似改了实则没用"的隐患）**
- `app/api/entry/analyze/route.ts`：episode idem key 由 `entry_${entryType}`（不带 tenant）改为 `deriveEpisodeId(rawText,{familyId,childId})`——原 key 多租户下第一个用户占用后其余被 `ON CONFLICT DO NOTHING` 吞掉，四模块 episode 沉淀对多用户失效；同时撤销 `facts≥2 跳过 entry_evidence`（按用户要求恢复总是入队，四模块一次性建档质量优先），entry_evidence idem key 改带 tenant+episodeId
- `src/lib/server/jobs/queue.ts`：新增 `digestUpdateBucketKey`（每租户每天 1 次），memory_write 链式 digest_update 改用此 key——原 null key 每次 memory_write 都跑 2 次 LLM（brief+board），对齐同行 Mem0/Zep「后台周期性合并」范式
- `app/api/board/route.ts`：自愈 digest_update idem key 由 null 改为 `digestUpdateBucketKey`（同频控）
- `app/api/daily/route.ts`（@deprecated）：对齐 stream——删 daily_deep 无条件入队 + 加 L1 optional（insufficient/safety 跳过 memory_write），防意外调用绕过降频

**为什么（同行研究 + 真实调用验证结论）**
- DeepSeek cache 字段名经官方文档确认为 `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens`，ark-agents 日志真实捕获；cache 要求前缀 ≥1024 tokens 且字节一致，parentFacingStyle 4.2k≈2.1k tokens 达标
- 全链路「真实调用」核实：entry/analyze→runEntryFollowUp/Summary→buildEntryAnalyzeSystem（含 parentFacingStyle）✅；registry.generated 真实重生（新版 parentFacingStyle）✅；getTurnEventByTraceId DB 主键直查可用 ✅；understanding-card useEffect 真实调 /api/daily/deep-expand（sessionStorage 幂等）✅；startJobPoller 经 instrumentation.ts 启动 + ecosystem NODE_ENV=production ✅；前端调 /api/daily/stream（deprecated 路由无前端调用）✅；<50 字硬追问不调 AI ✅；ASR 降级按钮 disabled ✅；daily/stream shouldWriteL1 真实生效 ✅
- 同行 Mem0 2026 单遍 ADD-only（冲突推迟到检索 recency-weighted rerank，降 60-70% 写入 LLM）；准入控制两阶段（规则过滤高召回→轻量 LLM 评分高精度）——我们的 L1 optional 即规则过滤层，Type Prior 按层分类已具备

**验证**
- `npm run typecheck` ✅ `npm run build` ✅（build-prompts 重生 35 prompt）
- 部署仍阻塞：`SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN` shell 变量未设置

**下一步**
- 用户 export 三变量后 `npm run deploy`，验证 readiness + pm2 log cache 命中率
- 观察 digest_update/model_review 每日桶频控后后台 LLM 调用数下降

**风险/冲突**
- digest_update 改每日桶后，当天首次触发后才建 brief，当天后续新证据要等明天进 brief（rebuildBriefAndBoard 读全量记忆，首次即反映当前全量，可接受）
- entry_evidence 恢复总是入队：四模块每模块 +1 次后台深度拆解（一次性，非高频）

---
## 2026-07-04 02:50 | Cursor | token 优化 + 记忆分层 + 四模块质量

**做了什么**
- `prompts/core/parentFacingStyle.md` 缩减 8k→4.2k 字符（删示例与文风金标准整节，保留铁律与文风核心）
- 四模块 capture 恢复 parentFacingStyle（`profile-build-prompts.buildEntryAnalyzeSystem`），稳定前缀利 DeepSeek prompt cache
- `ark-agents.ts` 加 `prompt_cache_hit_tokens`/`miss_tokens` 日志观测（JSON + 流式 `stream_options.include_usage`）
- `daily/stream` 删 `episode_ingest`/`daily_deep`/`model_review` 无条件入队（日常高频消耗消除）
- `jobs/queue.ts` `modelReviewBucketKey` 改每用户每天 1 次（自然日桶）+ memory_write 链式复用同 key
- 新增 `app/api/daily/deep-expand/route.ts`：深度展开/任务时入队 `episode_ingest` + `daily_deep`（低频深拆）
- `understanding-card` 进入时触发 deep-expand（幂等 sessionStorage 标记）；`task-service` 保存任务时同步入队 episode + daily_deep
- 记忆分层 l1_optional：`daily/stream` 对 `insufficient`/`safety` 跳过 memory_write（L0 turn_event 仍无条件写）
- `<50` 字硬追问（`EntryCapturePage`，不调 AI 绝对不可绕过；final 走独立页面天然豁免）
- ASR 降级：`useTencentAsrInput` 暴露 `asrUnavailable` + EntryCapturePage 语音按钮禁用提示
- 删 dead code `src/lib/server/context/retriever.ts`（localStorage 版，服务端全返空，无 import）

**为什么**
- 用户反馈 token 消耗过快：日常每条消息触发 4 个后台 job（episode/daily_deep/model_review + memory_write），高频烧 token
- parentFacingStyle 8k 字符每轮 SP 过长；四模块此前移除文风宪法导致输出质量下降
- 降日常高频消耗，保深度展开/建模质量；记忆关键写入（L0 总写、L2 按需、L1 编排判定）
- 全链路审查确认：daily 前端 prose/section/enrich 已注入 retrievalPack 全部 8 字段，无"没用上"的记忆

**验证**
- `npm run typecheck` ✅（build-prompts 重生 35 个 prompt）
- `npm run build` ✅
- 部署阻塞：`SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN` shell 变量未设置，需用户 export 后 `npm run deploy`

**下一步**
- 用户 export 三变量后跑 `npm run deploy`，验证 `curl https://yujian.yihe.site/api/readiness` ready:true
- 观察 pm2 log 中 `[cache:json]`/`[cache:stream]` hit/miss 确认 cache 命中率
- `digest_update` 含 2 次 LLM（familyBriefUpdater+boardUpdater）但有 contentHash 指纹短路；DB 写本身（executeWritePlan）零 LLM

**风险/冲突**
- 日常交流不再自动沉淀 episode；改为深度展开/任务时触发。若用户只日常聊不点深度展开，episode 池增长变慢（L0 turn_event 仍完整保留可回溯）
- `daily_deep` job 类型保留（handler 不删），仅日常不再触发；深度展开/任务时低频跑
- 其他 Agent 勿动：`app/api/daily/stream/route.ts`、`src/lib/server/jobs/queue.ts`、`src/lib/server/ark-agents.ts`

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

---

## 2026-06-18 03:26 | Codex | parent-corpus-ui-auth-regression

**做了什么**
- 用家长语料 + Chrome/Computer Use 做本地真人式流程回归。
- 修复用户侧 API 被内部 token guard 误拦的问题：新增 `verifyAppApi`，页面调用接口改为登录态 cookie + 同源校验，`/api/jobs/status` 仍保留内部鉴权。
- 修复日常页底部文字输入区的无障碍状态：关闭时不再挂载可交互控件，打开后“发送/清空”按钮有稳定名称。
- 教育诊断、家庭规划补充接口错误提示，避免后端 401/500 时前端静默无响应。

**为什么**
- 复测发现 `/education-diagnosis` 页面提交后没有任何反馈，根因是 `/api/education-diagnosis` 401 后前端吞错。
- 日常页二次输入的“发送”按钮在无障碍树里没有稳定名称，影响键盘/读屏与自动化回归。

**验证**
- `npm run typecheck`
- `npm run build`
- `http://127.0.0.1:3101/daily`：打开文字输入后可按“发送文字输入”提交，能看到家长输入和 AI/规则回复。
- `/api/education-diagnosis`、`/api/family-planner`：带 demo cookie + 同源 Referer/Origin 返回 200；仅 cookie 无同源头返回 401。
- 健康检查：`mock:false`、`database:true`。
- job_queue 从 500+ pending 持续下降到几十条，未见 failed。

**下一步**
- 若要完整跑完异步队列，保持 `3101` 服务和 `childos-parent-corpus-pg` 容器运行，poller 会继续消化 pending。
- `output/parent-corpus-test/` 是本轮批测产物，仍未跟踪，未纳入提交。

**风险/冲突**
- `npm run sync:gitee` 仍提示远程 `master` 不存在；当前本地分支是 `main`，origin 指向 GitHub。
- 当前无 FAST_AI key，教育诊断/家庭规划走规则/降级路径，不代表真实 LLM 质量验证。

---

## 2026-06-18 09:49 | Codex | parent-corpus-auth-hardening

**做了什么**
- 继续用家长语料做 479 条接口批测，并用 Chrome + Computer Use 走真人式页面抽样。
- 修复 `/api/rehearsal/analyze`、`/api/rehearsal/stream`、`/api/profile/weekly-review` 缺少用户侧 API 鉴权的问题，统一走 demo/正式登录 cookie + 同源 Referer/Origin 校验。
- 保留 `profile/weekly-review` 无 FAST_AI 时的 503 明确降级；不造假周报。

**为什么**
- 批测发现未登录也能直接 POST `/api/rehearsal/analyze`；周报 POST 未登录会返回 503 而不是 401，属于家长语料接口越权/语义错误。

**验证**
- `npm run typecheck`
- `npm run build`
- 家长语料接口批测：479/479 符合预期；entry/weekly 因无 FAST_AI 返回 503，daily/rehearsal/education/planner/multi 返回 200 或正常降级。
- 鉴权复测：rehearsal/weekly 带 demo cookie + 同源头可用；无 cookie 或 cookie 无同源头均 401。
- Chrome 真人路径：home→daily、rehearsal、education-diagnosis、family-planner、child-voice→multi-view 均可提交并展示结果/降级引导。
- job_queue 已全部 succeeded，无 pending/running/failed。

**下一步**
- 如果要测真实 LLM 质量，需要补 FAST_AI_API_KEY/FAST_AI_MODEL 后再跑 entry summary 与 weekly review。
- `output/parent-corpus-test/` 仍是未跟踪批测产物，不要提交。

**风险/冲突**
- `npm run sync:gitee` 仍提示远程 `master` 不存在；当前本地分支是 `main`。
- 当前 3101 服务正在用 `JOB_BATCH=40` 跑本地验证，可按需关闭。

---

## 2026-06-12 | Cursor | hi-fi 全站收尾 + 默认部署

**做了什么**
- hi-fi 主流程收尾：`profile/generating`、`result`、`deep/evidence/verify`、`final-follow-up`、预演子组件与 `/rehearsal` 结果步。
- `middleware` 补充 `/rehearsal/result` 重定向；`npm run deploy` + `.cursor/rules/deploy-after-update.mdc`（以后更新默认部署）。

**为什么**
- 以 hi-fi 四 Tab 为主产品；旧路由仅保留代码、由 middleware 跳到 `/daily`。

**验证**
- `npm run typecheck` ✅ `npm run build` ✅
- `npm run deploy` ✅ 服务器 readiness `ready:true`，PM2 `yujian` 已重启。

**下一步**
- 新功能只加在 hi-fi Shell；旧 `AppShell` 页面无需再迁。
- 每次可上线改动：typecheck → build → deploy（除非用户说先不部署）。

**风险/冲突**
- `README.md` 产品结构仍写旧五入口/ `/home`，文档待人工统一（不影响线上）。

---

## 2026-06-12 | Cursor | 画像页精简 + 交流正文行距

**做了什么**
- `/family-profile`：删除信息闭环、Current Insight、4-layer Model；Trend/Uncertainty 改名为「孩子最近变化」「待确认观点」；画像数据中心 5 张卡片楷体 + 字号/行距 +0.5pt。
- `/daily` 正文回复 `.bubble-reply`：行距 `1.72`（15px 字号）。
- 已部署 https://yujian.yihe.site

**验证**
- `npm run typecheck` ✅ `npm run build` ✅ `npm run deploy` ✅
- readiness：`ready:true` `mockMode:false` `databaseConfigured:true`

**下一步**
- 用户看线上正文行距是否合适，可再微调 `1.72` → `1.78` 等。
