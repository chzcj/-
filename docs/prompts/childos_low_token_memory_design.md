# ChildOS 低 Token 记忆库设计方案

## 当前结论

当前主流程的诊断、理解卡、建议卡、沟通预演和档案草稿，只读取本次 `conversation` 的轮次、摘要和已生成卡片，不读取家庭长期记忆。

当前会读取长期记忆的地方是 `/family-profile`：

- BFF 从 `memory_records` 读取最近 20 条。
- BFF 从 `child_events` 读取最近 10 条。
- 然后交给 `profileSnapshot` agent 生成家庭档案页面。

这意味着：现在长期记忆能服务家庭档案，但还没有服务主诊断；同时如果以后直接把 20 条记忆和 10 条事件全部塞给诊断 agent，会造成 token 浪费和速度下降。

## 目标

1. 服务主诊断：让 A1 能知道家庭近期重点，但不能每次读取长记录。
2. 服务家庭档案：A3 能生成近期变化、当前支持重点、最近记录。
3. 控制 token：诊断接口每次只读取短摘要，不读取完整记忆库。
4. 保留分级：单次事实、待验证方向、稳定画像要分开，不能混成一个“孩子画像”。
5. 保护质量：不能为了省 token 丢掉关键反证、修正记录和时间范围。

## 推荐记忆分层

### L0 本次工作上下文

来源：当前 `conversation.rounds`。

用途：只服务本次诊断和卡片生成。

输入给 AI 的内容：

- 最近 6-8 轮原始短文本或摘要。
- 当前最新追问。
- 已生成的理解卡摘要。

不进入长期记忆，除非归档或记录孩子时触发写入。

### L1 事件事实层

用途：可追溯，但不直接塞给每次诊断。

建议只存：

- `scene`：homework / phone / exam / conflict / emotion / school / peer / general
- `eventSummary`：40-80 字
- `evidenceShort`：原话证据 20-60 字
- `timeScope`：today / recent / last_week / this_month / unknown
- `source`：conversation / record_child / archive

不存：

- 整段聊天原文
- 整张理解卡
- 整张建议卡
- 长推理过程
- 大段前端文案

### L2 待验证方向层

用途：给诊断 agent 一个“家庭近期可能卡点”的短上下文。

建议只存：

- `hypothesis`：例如“数学作业更像卡在启动前压力”
- `supportingEvidence`：1-2 条短证据
- `needVerify`：下一次最值得问的问题
- `status`：active / weakened / resolved
- `confidence`：low / medium，不给前端展示

单次事件只能到 L2，不能升稳定画像。

### L3 稳定画像层

用途：只在多次证据一致时写入，数量要少。

建议限制：

- 每个孩子最多 5 条 active 稳定画像。
- 每条 60-100 字。
- 必须有 3 条以上同向证据或明确长期记录。
- 必须允许被 `correction_log` 修正。

### L4 家庭诊断摘要层

这是控制 token 的关键。不要每次给诊断 agent 传 L1-L3 明细，而是传一个短摘要。

建议新增或逻辑生成：

```json
{
  "familyBriefMemory": {
    "recentFocus": "近期主要围绕数学作业启动前拖延和催促后防御。",
    "activeHypotheses": [
      "可能卡在开始前压力，而不是单纯贪玩手机",
      "催促语言容易被孩子听成不被信任"
    ],
    "stableProfiles": [],
    "interactionPatterns": [
      "家长一提醒学习，孩子先烦或顶嘴，任务启动更慢"
    ],
    "avoidAssumptions": [
      "不要直接采信“懒”“沉迷手机”"
    ],
    "nextVerify": "下次优先确认拖延发生在开始前还是题目中途。",
    "updatedAt": "server time"
  }
}
```

诊断接口只读这一块，控制在 600-900 中文字以内。

### L5 家庭档案看板摘要层

服务 `/family-profile`，可以比诊断摘要稍长，但仍然不传全库。

建议包含：

- `recentChanges`：最多 3 条
- `currentFocus`：1 段
- `recentRecords`：最多 5 条短记录
- `communicationTip`：1 句
- `hasUnreadUpdate`

控制在 1200-1800 中文字以内。

## BFF 读取策略

### 诊断 A1

只传：

- 当前 conversation 最近轮次。
- `familyBriefMemory`。
- 必要的 `latestContradictions` 或 `correctionLogs` 最多 2 条。

不传：

- 最近 20 条 memory_records。
- child_events 长文本。
- archive 全文。

### 理解卡

传：

- 本次 conversation。
- `familyBriefMemory` 可选。

如果当前问题和记忆明显无关，不强行使用家庭记忆。

### 家庭档案

传：

- `profileBoardDigest`。
- 最近 5 条短事件。
- 最近 3 条修正记录。

不直接传全量 rawEvents。

## 写入策略

1. A1 只输出 `memoryCandidates`，不直接写库。
2. A2 接收 `memoryCandidates + 本轮短输入 + 当前 familyBriefMemory`。
3. A2 判断是否写入 L1/L2/L3，并更新 L4/L5 摘要。
4. BFF 校验、去重、写 PostgreSQL。
5. A3 只根据 L5 和少量近期事件生成家庭档案。

## 数据量限制

- `memoryCandidates`：每轮最多 3 条，每条 summary 18-45 字。
- `rawEvents`：长期保留可以多，但默认不喂给 AI。
- `activeHypotheses`：最多 6 条。
- `stableProfiles`：最多 5 条 active。
- `familyBriefMemory`：最多 900 中文字。
- `profileBoardDigest`：最多 1800 中文字。
- 归档后可异步压缩，不阻塞前端。

## 需要改动的代码方向

1. `src/lib/server/db.ts`
   - 增加读取短摘要的方法，例如 `loadFamilyBriefMemory`。
   - 增加摘要 upsert 方法，例如 `upsertFamilyMemoryDigest`。

2. `src/lib/server/store.ts`
   - 主诊断 payload 加 `familyBriefMemory`，但不要传全量记忆。
   - `confirmArchive` 后调用 A2，更新摘要。

3. `app/api/profile/snapshot/route.ts`
   - 优先读取 `profileBoardDigest`。
   - 只补充最近少量事件。

4. A2 prompt
   - 保留分级，但输出给 BFF 的写入计划要短。
   - 增加 `familyBriefMemoryPatch` 和 `profileBoardDigestPatch`。

5. A3 prompt
   - 只读看板摘要，不读后台全表。

## 不建议做的事

- 不要让 A1 每次读取最近 20 条 memory_records。
- 不要把理解卡、建议卡、预演结果全文写入长期记忆。
- 不要单次事件直接生成稳定画像。
- 不要为了前端好看编造家庭档案。
- 不要让前台展示 confidence、evidence_count、pending_hypothesis 这些后台词。
