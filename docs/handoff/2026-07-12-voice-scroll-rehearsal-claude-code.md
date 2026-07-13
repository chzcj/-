# 育见小程序：语音 / 回底 / 键盘 / 预演深度 — Claude Code 交付手册

**给**：朋友的 Claude Code（或下一位 Agent）  
**日期**：2026-07-12（v5，若我来改的根因排序）  
**仓库**：Gitee `https://gitee.com/heartlab/yujian` · 分支 `master`  
**工作区**：`/Users/mac/Desktop/育见-2`  
**原则**：先全局审查 → 小步修改 → 三轮自检 → 部署。语音按 H0→H1→H2 修；禁止只改波浪；禁止再甩锅域名。

---

## 0. 一句话任务

修好小程序真机上这几件事（**不是**「再提醒用户扫码/配域名」）：

1. **按住说话从未成功出字**（每次松手发不出文字）  
2. **松手后 UI 仍像按住**，要再按一次才复位  
3. 删除「连接中」等工程态文案  
4. **交流页发送后不自动滚到底**  
5. **预演自定义场景**：停在页面中部点输入框，键盘抬一半就掉；滚到页底才正常  
6. **预演真实对话**里孩子回话表面，未真正用上孩子理解/画像  

---

## 1. 绝对不要再犯的误诊（用户已证伪）

下列原因 **已排除**，写入 HANDOFF/回复时禁止再甩锅：

| 已排除项 | 用户证明 |
|----------|----------|
| 没编译 / 没重新预览扫码 | 每次都做完整 |
| 没勾「不校验合法域名」 | 已勾 |
| 只用模拟器测 ASR | 真机测试 |
| 没配 socket 域名 | 公众平台已是 `wss://asr.cloud.tencent.com`；request 为 `https://yujian.yihe.site` |
| 「假 UI」只是 CSS | ASR **从来没有正常出过字**；假动效是状态机副产品 |

既往 Agent 多轮失误：把责任推给交付链，改波浪/`debugLog`/域名文案，**没修松手结算与 connecting 挂起**。

---

## 2. 环境与工具（操作备忘，不是 bug 原因）

### 2.1 仓库与协作

```bash
cd /Users/mac/Desktop/育见-2
npm run sync:gitee          # 开工必跑
# 读 .agents/HANDOFF.md 最新一条
```

- Commit 前缀：`[cursor]` / `[codex]` 等  
- 主远程：Gitee `origin`；GitHub 另议（SSH 曾 Permission denied）  
- **禁止**把 `.env.local`、SSH、TENCENT Secret、AUTH_TOKEN 写入 Git / HANDOFF  

### 2.2 小程序构建（用户会自己预览；你负责产出正确 dist）

```bash
cd miniprogram
npm run build:weapp    # 或 npm run dev:weapp
```

- 微信开发者工具打开目录：`…/育见-2/miniprogram`（含 `project.config.json`）  
- `miniprogramRoot: dist/` —— 工具读编译产物  
- AppID：`wx85cc99d660b0c0ac`  
- `npm run deploy` **只更新 Web/BFF**，不更新小程序包（用户知道）  

### 2.3 微信开发者工具 MCP（可选）

Skill：`.agents/skills/wechat-devtools/SKILL.md`  
服务端口须开启；改代码后 `compile`；真机预览由用户扫码。

### 2.4 BFF

- 线上：`https://yujian.yihe.site`  
- ASR：`GET /api/asr/token` → 返回腾讯 `wsUrl`  
- 预演：`POST /api/rehearsal/analyze`（NDJSON 流式）  
- 改 BFF 后：根目录 `typecheck` → `build` → `deploy`（需本机 `SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN`）  

---

## 3. 当前产品流程（理解）

```
登录
 →（可选）onboarding 建档（BuildRecordBox 也用同一 ASR hook）
 → 四 Tab
    ├─ 交流 daily：HiFiInputZone → /api/daily/stream
    ├─ 任务 tasks
    ├─ 预演 rehearsal
    │     entry：选场景 / 自定义 Textarea → 开始预演
    │     confirm → active 多轮对话 → /api/rehearsal/analyze
    │     旁路：亲子录音 dialogue（本轮非焦点）
    └─ 画像 profile
```

语音目标链路：

```
touchStart → 权限 → RecorderManager PCM 16k
          → GET /api/asr/token → connectSocket(wss://asr.cloud.tencent.com/...)
          → onOpen → 发送缓冲帧
          → onMessage 转写
touchEnd  → 立刻退出按住 UI → stopListening → 有字则 onSubmit / 无字则明确提示
```

---

## 4. 问题清单与根因（源码级，防幻觉）

### 4.1 P0：从未出字 + 松手 UI 卡住（多层原因，防幻觉）

**关键文件**

- [`miniprogram/src/components/hifi/HiFiInputZone/index.tsx`](miniprogram/src/components/hifi/HiFiInputZone/index.tsx)  
- [`miniprogram/src/hooks/useTencentAsrInput.ts`](miniprogram/src/hooks/useTencentAsrInput.ts)  
- 同态机：[`BuildRecordBox.tsx`](miniprogram/src/components/profile/BuildRecordBox.tsx)  

**不要写成「唯一根因」。分层如下：**

| 假设 | 置信 | 解释什么 | 证据 |
|------|------|----------|------|
| **H0 按住换子树丢 touchEnd** | 高（首选解释「再按一次」） | 第一次松手 `finishVoice` 没跑 → UI 卡住 + 无发送 | `setUiHolding(true)` 后把文字节点整段换成波浪 View；同一次按住手势中替换触摸子树易丢 touchend |
| **H1 松手状态机** | 代码已证明 | touchEnd 到了仍可能卡住/无字 | `holdActive` 绑 connecting；connecting 中只 pendingStop；失败不 settle；error 被藏住 |
| **H2 缓冲帧瞬时倾倒** | 高（与腾讯文档冲突） | 连上后仍可能无字 | 先录音再连；`onOpen` 瞬时 flush；过快会断连 |
| **H3–H7** token/握手/零帧/4004 等 | 需 Console | H0–H2 修完仍无字再查 | 见取证表 |

**H1 机制（现行代码）**

```text
holdActive = uiHolding || isListening || isConnecting
松手: setUiHolding(false); if (isConnecting) { pendingStop; return }  // 不 stop
未 onOpen: 帧只进 buffer；错误在 holdActive 时不展示
再按一次: startListening→cleanup → UI 才复位
```

**H2 机制**

```text
startEarlyRecorder → 缓冲 PCM
await token + connectSocket（真机可达数秒）
onOpen → flushFrameBuffer 瞬时发完全部缓冲  // 可能触发腾讯「推流过快」断连
```

**改前真机取证（禁止跳过）**

| 看什么 | 若失败指向 |
|--------|------------|
| `GET /api/asr/token` 是否 200 | H3 鉴权/密钥 |
| 是否 `onOpen` + handshake `code=0` | H4 握手/签名 |
| `framesSent` 是否 >0 | H5 未推流 |
| 腾讯 message 是否含 4004/过快/未发送音频 | H2/H7 |
| 松手后 `isConnecting` 是否仍 true | H1 |

**修复顺序**：H0 稳定触摸目标（按住不换子树 + catchTouchEnd）→ H1 强制 settle / 解绑 holdActive / 错误可见 / 删「连接中」→ H2 先 socket 再录音或节流 flush + 短超时 → 真机取证 H3–H7 → 仅当取证指向时才动 token/签名/资源包。

**禁止**：只改波浪文案；无取证改 `voice_format`/换引擎/换厂商；再归因域名/扫码。

Web ASR（`/api/asr/stream`）本轮默认不改。

### 4.2 P1：交流发送不回底

**文件**：[`useChatAutoScroll.ts`](miniprogram/src/hooks/useChatAutoScroll.ts)、[`pages/daily/index.tsx`](miniprogram/src/pages/daily/index.tsx)、[`pages/daily/index.scss`](miniprogram/src/pages/daily/index.scss)、[`styles/hifi-base.scss`](miniprogram/src/styles/hifi-base.scss)（`.page { overflow-y: auto }`）

**根因**：内层 `ScrollView` 套在可滚的 `.page` 上（违反 PORTING「单滚动容器」）；daily 仅 `height:100%`，缺 rehearsal active 的 `max-height: calc(100vh - …)`；hook 同时推 `scrollIntoView` + `scrollTop`。

**修复**：daily 唯一有界 ScrollView；明确视口高度；hook **只** `scroll-into-view`；发送强制跟底。

### 4.3 P2：自定义场景键盘中部掉

**文件**：[`pages/rehearsal/index.tsx`](miniprogram/src/pages/rehearsal/index.tsx)（自定义 Textarea ~419–467 行）

**根因（用户自证）**：中部 focus 掉、滚到底正常 → 滚动位置问题。代码用 `Taro.pageScrollTo` 打原生页，实际滚的是壳内 `.page` CSS overflow；`adjustPosition` 与固定 custom-tab-bar 竞态。

**修复**：entry 有界 `ScrollView`；focus → `scroll-into-view` 到 `#custom-scenario-card`；关或慎用 `adjustPosition`；`cursorSpacing` 按 tabBar+safe 算。禁止再堆 pageScrollTo 延时。

### 4.4 P3：预演孩子表面

**不是**「没有 agent」。BFF [`app/api/rehearsal/analyze/route.ts`](app/api/rehearsal/analyze/route.ts) 已有 profile-aware 流式 Agent。

**真正缺口**

| 缺口 | 证据 |
|------|------|
| 多轮不传对话史 | `runTurn` 只发当前家长句 + 场景；`feed` 不上传 |
| 画像映射错/瘦 | `supportFocus` 冒充保护策略；`evidence` 未传；`familyInteractionCycles` 未传 |
| retrievalPack 过瘦 | 仅 4 字段，无 daily 的 entryFacts/childQuotes |
| 孩子回复硬限 | `rehearsal-stream` 任务写 20–60 字 |
| 静默降级 | LLM/检索失败 → 关键词模板，仍像「有回复」 |

**修复**：`rehearsalTranscript`；纠正 profile 映射 + hydrate；加厚 pack；放宽字数并要求机制锚点；可选降级标记。先不拆双模型。

---

## 5. 产品方案（前端 / BFF / 后端）

### 5.1 分层

| 层 | 职责 |
|----|------|
| 小程序 | 按住状态机、ASR 生命周期、ScrollView 跟滚、键盘避让、组装 profile+transcript、展示 SecondMe |
| BFF | token 签发、rehearsal analyze 流式、记忆检索组装、TurnEvent |
| 存储/腾讯 | digest、retrieval、profile；腾讯实时 ASR |

### 5.2 建议实现顺序

1. P0 语音状态机（HiFiInputZone + useTencentAsrInput + **BuildRecordBox**）  
2. P1 交流回底  
3. P2 自定义键盘  
4. P3 预演深度（小程序 + BFF）  
5. 三轮自检 → BFF 改则 deploy → 用户真机预览验收  

### 5.3 影响面

- 页面：daily、rehearsal entry/active、onboarding capture/follow-up  
- 接口：`GET /api/asr/token`（调用超时/错误处理；签发逻辑原则上不动）、`POST /api/rehearsal/analyze`（扩展 body，**兼容缺 transcript**）  
- 状态：按住/松手、busy 排队、feed/round、跟底开关  

### 5.4 暂不改

- Web ASR / Web 预演像素  
- 换 ASR 厂商  
- 亲子录音 dialogue 旁路大改  
- 拆「孩子 Agent」双调用（先 transcript+厚包）  
- 密钥入库  

---

## 6. 修改前必须输出（给产品确认）

每次动手前在对话里写清：

1. 理解的当前产品流程  
2. 问题清单  
3. 每个问题根因  
4. 准备改哪些文件  
5. 每个文件为什么改  
6. 影响哪些页面/接口  
7. 哪些暂时不改及原因  

**确认后再写代码。** 不确定是否影响主流程 → **先问用户，不大改。**

---

## 7. 修改时约束

1. 每次只围绕明确问题，不做无关重构  
2. 前端对照 iPhone 13 / 390 宽  
3. API 兼容缺字段旧客户端  
4. 状态：刷新、返回、重复点击、页面恢复  
5. 流式：首字、是否一股脑、最终是否保存  
6. 按钮：disabled/loading/重复提交  

---

## 8. 三轮自检（强制）

### 第一轮：代码

- 根目录 + miniprogram：`npm run typecheck`  
- 根目录：`npm run build`（若动了 BFF/共享）  
- miniprogram：`npm run build:weapp`  
- 无无用 import/死代码；**无** `.env.local`/密钥入库  

### 第二轮：产品流程

白屏、按钮、loading、路由、轮数、输入禁用、档案可回、耗时、布局溢出。

### 第三轮：真机（用户流程）

用户会：编译 + 新预览扫码。你要保证行为正确：

- [ ] 按住说话 → 松手 → **有字或明确错误**  
- [ ] 松手 → **立刻**非按住 UI（无需二次点击）  
- [ ] 无「连接中」  
- [ ] 交流发送回底  
- [ ] 自定义场景中部 focus 键盘不掉  
- [ ] 预演第 3 轮能引用第 1 轮家长原话  

若仍无字：用 Console 查 handshake `code`、是否 send 了二进制帧、腾讯返回码——**禁止**再归因域名/扫码。

---

## 9. 最终回复用户格式

```text
1. 已修改的问题
2. 修改了哪些文件
3. 为什么这样改
4. 三轮自检结果
5. 仍然存在的风险或待优化点
```

---

## 10. 待产品拍板（动手前问清；下列为推荐默认）

若用户尚未答复，**用推荐默认并在 HANDOFF 写明**；有答复则以答复为准。

| # | 问题 | 推荐默认 |
|---|------|----------|
| 1 | 满波浪时机 | 轻反馈可立即；满波浪在真正开始录音后 |
| 2 | 松手 UI | 立刻回「按住说话」，后台收尾；有字再发送 |
| 3 | 失败提示 | 输入条上方短文案（必要可加 Toast） |
| 4 | 交流语音成功 | 自动发送（保持 `voiceMode='send'`）；预演 fill/send 与现网一致 |
| 5 | 建档按住 | 与交流同一套松手/复位规则 |
| 6 | 删「连接中」后 | 按住未就绪：只轻态/无「连接中」字 |
| 7 | 误触短按 | 提示「请按住说话」并丢弃 |
| 8 | 回底场景 | 文字+语音发送都强制回底 |
| 9 | 用户上滑看历史时新消息 | 停在历史（不强制拽回），除非再次发送 |
| 10 | 流式变长 | 跟滚开启时钉底 |
| 11 | 自定义 focus | scroll-into-view 卡片进键盘上方 |
| 12 | Tab 栏与键盘 | 可先保持可见；若仍掉再藏 Tab |
| 13 | Textarea | 保留多行 |
| 14 | 真实预演 | = 选场景后多轮对话页 |
| 15 | 深度优先级 | 机制感 + 多轮前文 > 空泛口吻 |
| 16 | transcript | **必须**每轮带上 |
| 17 | 无画像 | 可变浅并提示完善，不阻断 |
| 18 | 显示参考要点 | 可做可折叠（P1，非阻塞） |
| 19 | 孩子回复长度 | 允许稍长以点出机制（约 40–120 字） |
| 20 | 范围 | 小程序 + 必要 BFF；Web ASR 不动 |
| 21 | deploy | BFF 有改必须 deploy；纯小程序可先真机验 |
| 22 | 禁区 | 不大改 onboarding 流程结构；只对齐 BuildRecordBox 语音态机 |

---

## 11. 关键路径速查

| 用途 | 路径 |
|------|------|
| 本手册 | `docs/handoff/2026-07-12-voice-scroll-rehearsal-claude-code.md` |
| 协作留言 | `.agents/HANDOFF.md` |
| ASR 架构备忘 | `miniprogram/docs/streaming-asr-architecture.md` |
| M9 ASR 报告 | `miniprogram/docs/module-reports/M9-asr.md`（真机 E2E 仍 open） |
| 预演模块 | `miniprogram/docs/module-reports/M6-rehearsal.md` |
| PORTING | `miniprogram/docs/PORTING.md` |
| 小程序 README | `miniprogram/README.md` |
| 计划稿 | `.cursor/plans/root-cause_four_bugs_b07bed60.plan.md`（若存在） |

---

## 12. 收工

1. 更新 `.agents/HANDOFF.md`：真因是状态机/滚动容器/单轮预演，**不是**域名/预览  
2. Commit（用户要求时）`[cursor]/…`  
3. `git push origin master`（用户要求时）  
4. BFF 改动：`deploy` + readiness 检查  

---

**手册结束。** 把本文件路径发给 Claude Code 即可作为唯一开工入口；改代码前先完成第 6 节确认与第 10 节拍板（或采用推荐默认并写明）。
