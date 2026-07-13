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

## 部署状态

- 2026-07-13 21:02 | Cursor | PRODUCT/DESIGN 记忆中心架构文档（功能×Agent×组件对照）
- 2026-07-13 21:00 | Cursor | 体验优先 onboarding + README 产品/设计说明重写；推送 Gitee + GitHub
- 2026-07-13 20:42 | Cursor | 交流/预演按住说话：底部浅绿实时字幕通栏（VoiceHoldLiveBanner）
- 小程序 `build:weapp` 后真机预览验收

---

## 2026-07-13 21:02 | Cursor | PRODUCT/DESIGN 记忆文档

**做了什么**
- `PRODUCT.md`：记忆中心架构、功能×记忆×Agent 表、越用越懂闭环、体验优先 onboarding
- `DESIGN.md`：组件×记忆来源、Onboarding 组件表、流式与 memory-status 时序
- `deep-modeling.md` / `README.md` 交叉引用

**验证**
- 文档-only，无代码变更

**下一步**
- 新功能/组件 PR 时对照 PRODUCT/DESIGN 表声明记忆读写路径

---

## 2026-07-13 21:00 | Cursor | 体验优先 onboarding + README

**做了什么**
- 小程序：开始页仅隐私+开始；Hub 点模块前 WechatLoginSheet；画像后填 basic；BFF onboardingComplete 时机调整
- UI：intro 边框、采集 chip/换题按钮、预演滚动、VoiceHoldLiveBanner
- 重写 `README.md` 产品说明与设计说明（新 onboarding、四 Tab、hi-fi 视觉、ASR 分工）
- push `origin master` + `github master`

**验证**
- 此前 typecheck / build:weapp 已通过；BFF 早前 deploy readiness true

**下一步**
- 真机走通：开始→intro→hub→登录→capture→result→basic→四 Tab
- 按住说话通栏与预演滚动验收

**风险/冲突**
- 语音链路仍锁定；勿改 `useTencentAsrInput` 等除非用户授权

---

## 2026-07-13 20:42 | Cursor | 按住说话实时字幕通栏

**做了什么**
- 新建 `VoiceHoldLiveBanner`：输入条上方浅绿通栏，2～3 行实时转写
- `HiFiInputZone` 挂载（交流页 send + 预演 fill），只读 transcript，未改 ASR 链路

**验证**
- typecheck / build:weapp 通过

**回退**
- 删除 `VoiceHoldLiveBanner.*` + 去掉 `HiFiInputZone` 内挂载即可

---

## 2026-07-13 20:22 | Cursor | 专项采集 · intro · 预演滚动 UI

**做了什么**
- `.record-status` chip flex 居中（capture + follow-up 共用 BuildRecordBox）
- 采集页「换一个问题」→ 浅绿描边按钮
- intro 两段正文加浅绿细边框
- 预演 active 步：flex 布局 + 底部 anchor，修手动滑到底

**验证**
- typecheck / build / build:weapp 通过

**下一步**
- 真机：预演 3 轮后手动滑到底；chip 上下留白

---

## 2026-07-13 19:47 | Cursor | 体验优先建档 + UI 精修

**做了什么**
- 开始页仅「开始」+ 隐私勾选，不再首屏微信登录
- intro 充实 AI/SecondMe 文案 + tag chips；hub 点模块**进采集前**弹 WechatLoginSheet（mergeLocal 登录）
- capture 无 token 重定向 hub；basic 挪到画像结果后；`onboardingComplete` 延后到填昵称年级
- BFF：`POST /api/profile/built` 不再置完成；`POST /api/profile/basic` 有画像时置完成
- hub hero 换行修复；登录弹窗 UI 精修；去掉用户可见「服务器/同步」文案

**为什么**
- 审核「先体验后授权」；未登录不进采集避免与语音链路冲突（语音文件仍锁定）

**验证**
- `npm run typecheck` / `npm run build` / `miniprogram build:weapp` 通过
- `npm run deploy` exit 0；`curl readiness` → `ready: true`

**下一步**
- 开发者工具真机预览：开始→intro→hub→点模块登录→采集语音→四模块→画像→填信息→四 Tab
- 提审前核对公众平台隐私指引

**风险/冲突**
- 勿改 `useTencentAsrInput` / `recorderState` 等语音链路
- 历史已 `onboardingComplete` 老用户不受影响

---

## 2026-07-13 16:45 | Cursor | 审核合规登录 + 语音锁定

**做了什么**
- 新增 `.cursor/rules/voice-input-locked.mdc`：语音已验收，改动须先问用户
- 登录页：去掉「登录即同意」；隐私框默认未勾选；未勾选不可登录
- 文案改为「微信登录」+ 明确不获取手机号/头像/昵称（仍仅 `wx.login`）
- 更新 `REVIEW-SUBMISSION.md` 审核备注与驳回应对

**验证**
- typecheck + build:weapp（进行中/见下）

**下一步**
- 开发者工具预览登录页勾选流程；公众平台核对隐私指引收集项；重新提审

**风险/冲突**
- 勿改语音相关文件（见 voice-input-locked 规则）

---

## 2026-07-13 01:50 | Cursor | 讯飞解析 + end sessionId + PCM 节流

**做了什么**
- `iflytekRtasrParse`：认 `data.action=started/end/error`（实测包形）
- end 只用引擎 `sessionId`，禁用 BFF uuid 冒充
- PCM 统一入队 + 40ms 冲刷，避免瞬时倾倒
- README 拆清实时讯飞 vs 亲子腾讯文件 ASR

**验证**
- 线上 iflytek/url + wss OPEN + started 包形 ✅；parser 单测 ✅；typecheck/build:weapp

**下一步**
- 真机：亲子录音；交流按住出字（确认公众平台讯飞 socket 域名）

---

## 2026-07-13 01:45 | Cursor | 亲子录音误杀 + 讯飞 Key

**做了什么**
- `recorderState` claim 所有权：失权后 realtime cleanup 绝不 `stop()` 全局录音器
- `useTapFileRecorder`：session/started 守卫；开录前接管残留录音
- `.env.local` `IFLYTEK_API_KEY` 31→32 位（末尾缺 1 导致 35010）

**为什么**
- 预演页 `navigateTo` 后 HiFiInputZone 仍存活，握手超时 cleanup 掐死亲子 mp3 录音 →「录音失败」
- 讯飞 Key 截断 → 全入口「语音连接超时」

**验证**
- miniprogram typecheck + build:weapp ✅；deploy 同步 env

**下一步**
- 真机：先测亲子录音（不测实时也可）；再测交流按住（需讯飞域名）

---

## 2026-07-13 01:33 | Cursor | 讯飞实时转写方案 A 直连

**做了什么**
- BFF：`GET /api/asr/iflytek/url`（HMAC 签名 wss）
- 小程序：RecorderManager + 直连讯飞；临时/最终分句合并
- 移除 QCloudAIVoice 插件；亲子对话仍腾讯文件 ASR

**验证**
- typecheck + build:weapp ✅；线上 iflytek/url ✅

**下一步**
- 公众平台加讯飞 socket 域名；真机按住说话验收

---

## 2026-07-13 01:25 | Cursor | 官方 ASR 插件替代自拼 WebSocket

**做了什么**
- 新增 `GET /api/asr/credentials`（STS 临时密钥，仅 asr:* 权限）
- `useTencentAsrInput` 改接 `QCloudAIVoice.speechRecognizerManager()`：插件内录音+识别
- 临时结果覆盖、句末固化（OnRecognitionResultChange / OnSentenceEnd）
- `app.config.ts` 声明插件 2.3.12；亲子对话 file ASR 未动

**为什么**
- 自拼 connectSocket+RecorderManager 在真机反复握手超时/录音误杀；官方插件由腾讯维护 wss 与分片

**验证**
- 根目录 + miniprogram typecheck ✅；build:weapp ✅；deploy ✅；credentials API 线上可签发

**下一步**
- 真机按住 ≥2s 测交流/预演/四模块；若报「未加载插件」→ 公众平台添加腾讯云智能语音

**风险/冲突**
- 主账号 CAM 须允许 GetFederationToken；勿把密钥写入 Git

---

## 2026-07-13 01:06 | Cursor | 录音误杀回归 + ASR 代理

**做了什么**
- 按 Claude「爽了」最小修法恢复 `recordingStartedRef`：空闲绝不 `stop()`
- `recorderState` 全局 onStop/onError 不再无条件清 `active`；迟到回调按 session gen 丢弃
- 小程序实时 ASR 改连 `wss://yujian.yihe.site/api/asr/stream`（与 Web 一致，去掉直连腾讯 token）
- 短按误触静默；概括演进 N=2 写入 parentFacingStyle/Copy；PRODUCT 对内改称四模块
- 生产 deploy 完成

**为什么**
- 「约1s自动退出 / 录音失败」与 idle-stop 幽灵 onError 同类；`recorderState.active` 守卫在迟到回调下会误杀新一轮

**验证**
- miniprogram typecheck + build:weapp ✅
- 根目录 typecheck ✅；deploy 后 readiness ready:true

**下一步**
- 用户真机：重新编译预览 → 连按 6–8 次再按住 ≥2s；交流/预演/四模块同测
- 语音通了再 `[cursor]` 小提交（本轮按约定未 commit）

**风险/冲突**
- 勿再把域名/真机调试甩给用户；勿再叠一层录音状态机
- 勿把密钥写入 Git/HANDOFF

---

## 2026-07-12 17:35 | Cursor | 麦克风无弹窗 → Claude 迁移说明

**做了什么**
- 用户确认：其它修复 OK；语音仍无字且**完全没有授权弹窗**
- 新增交付文档：`docs/handoff/2026-07-12-mic-permission-popup-claude.md`
- 核心怀疑：`touchStart` 里 `await getSetting` 后丢失用户手势；以及 `!holdingRef` 提前 return 吞掉 interactive 申请

**为什么**
- 交给 Claude 继续；Cursor 侧权限改法未解决弹窗

**验证**
- 仅文档；未再改业务代码

**下一步**
- Claude 按该文档 Step A→B 做手势安全授权入口（独立 Button）并打 fail.errMsg

**风险/冲突**
- 勿与交流回底/预演跟滚/乱码已修好路径冲突

---

## 2026-07-12 17:25 | Cursor | 修复麦克风权限未真正弹出

**做了什么**
- 去掉对 `Taro.authorize` 的 8s `Promise.race`（会造 `(in promise) SystemError timeout`，弹窗还在就被判失败）
- 隐私 API 优先走全局 `wx`；超时不再假装「无需授权」
- 按住说话：若尚未授权，先交互式申请麦克风（showModal → authorize），成功后提示「再次按住」；不在按住过程中弹系统窗
- 亲子录音 / BuildRecordBox 同步

**为什么**
- 用户反馈语音仍无字，怀疑没申请麦克风；根因是授权 race + 按住中弹窗被松手打断

**验证**
- typecheck + build:weapp 通过

**下一步**
- 真机：第一次按住应出现「允许使用麦克风」→ 系统授权 → 再按住 ≥2s 应有字

**风险/冲突**
- 仅 miniprogram；未 commit

---

## 2026-07-12 17:10 | Cursor | ASR 早开麦 / 亲子录音 / 乱码 / 预演跟滚

**做了什么**
- `useTencentAsrInput`：恢复权限后立刻开麦 + socket 并行；onOpen 后 50ms 节流 flush；松手短等握手 1.5s；无字时明确报错
- 隐私/录音权限：`getPrivacySetting` / `requirePrivacyAuthorize` / `authorize` 8s 超时兜底
- `useTapFileRecorder`：`!ok` → `!perm.ok`；亲子对话主按钮 `Text` → `View` 加大热区
- 预演 active：去掉 `useChatAutoScroll` 自动跟滚（交流 daily 保持）
- `dailyStream` / `rehearsalAnalyze`：`TextDecoder({ stream: true })` 防 UTF-8 截断乱码

**为什么**
- 上次「握手后再开麦」导致松手时录音未开始 → 空 transcript；亲子按钮权限判断与 Text 点击弱；流式中文乱码；预演不需要自动下滚

**验证**
- `miniprogram` typecheck pass；`build:weapp` 成功（已知 CSS order warning）
- 未改 BFF，未 deploy

**下一步**
- 真机重新预览验收：按住 ≥2s 有字或明确错误；亲子「开始录音」可点；交流仍回底、预演不跟滚；长中文无乱码

**风险/冲突**
- 仅改 `miniprogram/`；勿动本批 ASR/流式文件除非真机仍失败
- 未 commit / 未 push（等用户指示）

---

## 2026-07-12 16:55 | Cursor | BFF deploy（预演 transcript 等）

**做了什么**
- 用本机 shell 环境变量执行 `npm run deploy`，上线 rehearsal transcript / 厚 pack 等 BFF 改动

**验证**
- deploy exit 0；PM2 reload 成功；API 抽样 ok

**下一步**
- 小程序重新编译预览，验收语音松手复位+出字、回底、键盘、预演多轮

**风险/冲突**
- 勿把 SSH/AUTH 写入 Git 或 HANDOFF 正文

---

## 2026-07-12 16:50 | Cursor | 语音H0/H1/H2 + 回底/键盘/预演transcript

**做了什么**
- 语音 H0：按住不换子树（波浪 CSS 显隐），松手立刻清 fingerDown，避免丢 touchEnd / 二次点击才复位
- 语音 H1：松手强制 stopListening；hold 视觉不再绑 isConnecting；删「连接中」；错误始终可见；BuildRecordBox 对齐
- 语音 H2：先 token+socket 握手成功再开麦；握手/token 短超时；松手 bump sessionGen 打断异步开麦
- 交流回底：daily 明确视口高度；useChatAutoScroll 只用 scrollIntoView
- 预演自定义场景：entry ScrollView + focus scroll-into-view；关 adjustPosition 竞态
- 预演深度：多轮 rehearsalTranscript + 证据字段；BFF 吃 transcript；孩子回复放宽 40–120 字

**为什么**
- 真因是状态机/触摸/推流，不是域名或未预览（用户已证伪）

**验证**
- miniprogram + 根 typecheck ✅；build:weapp ✅；根 build ✅
- deploy：本 shell 无 SSH_HOST，未上线 BFF（预演深度需 deploy 后真机才吃到）

**下一步**
- 导出 SSH_* 后 `npm run deploy`
- 小程序重新编译预览：验第一次松手复位 + 出字/明确错误；回底；中部键盘；多轮预演

**风险/冲突**
- 勿把密钥写入 Git/HANDOFF；纯小程序语音修复不依赖 deploy，预演 transcript 深度依赖 BFF deploy

---

## 2026-07-12 15:30 | Cursor | 假UI/回滚/键盘/预演深度

**做了什么**
- 删除 `debugLog` 裸 `fetch`（微信无 fetch → 假 UI 根因）
- TENCENT_* 写入 `.env.local` 并 deploy（不入库）
- `useChatAutoScroll`：键盘不再永久关跟滚；发送强制回底
- 预演自定义场景 focus 时 `pageScrollTo` 到底 + cursorSpacing 180
- 预演传 `profileContext`/`rehearsalContext`；BFF 加强机制约束 + 非 fast 检索

**验证**
- miniprogram/root typecheck ✅；build:weapp ✅；deploy exit 0；dist 无 debug ingest

**下一步**
- 真机预览：按住应真实录音并松手出字；交流回底；自定义场景键盘；预演更贴画像

**风险**
- 勿把 TENCENT/SSH 写入 Git/HANDOFF

---

## 2026-07-12 14:55 | Cursor | BFF deploy（任务/流式/action-composer）

**做了什么**
- 用本机 shell 环境变量执行 `npm run deploy`，上线 action-composer 祈使任务标题兜底、tasks observation、流式 delta 防重复

**验证**
- deploy exit 0；随后 curl readiness

**下一步**
- 小程序：开发者工具编译 → 预览重新扫码验收语音

**风险**
- 勿把 SSH/AUTH 写入 Git 或 HANDOFF 正文

---

## 2026-07-12 14:50 | Cursor | 真机语音零反馈 + 输出/任务闭环

**做了什么**
- P0-1：hold 用 View + 同步 uiHolding 立刻波浪/「连接中」；`startListening` 首行 `setIsConnecting(true)`；`asrUnavailable` 不再含 simulator
- P0-2：`stripParentFacingMarkdown` + `mergeStreamChunk`；contracts/web/mp 流式防累计重复
- P0-3：任务短祈使标题 + 副文案；BFF `deriveImperativeTaskTitle`；tasks API 支持 observation
- P1：pill / end-actions 36px

**验证**
- miniprogram typecheck + build:weapp ✅；根 typecheck ✅
- dist：无 catchTouch、无 scope.record permission、有连接中/wave

**下一步**
- 设置 SSH_* 后 `npm run deploy`
- 开发者工具编译 → 预览重新扫码：按住立刻波浪 → 松手发送

**风险**
- BFF 未上线前，真机任务标题仍可能缺 AI taskTitle（前端有 advice 兜底）
- debugLog 埋点仍在，验收后删

---

## 2026-07-12 14:45 | Cursor | 交流页白屏崩溃 + 产品决策落地

**做了什么**
- 移除 `app.config` 里无效的 `permission.scope.record`（官方 permission 仅支持地理位置类）
- `HiFiInputZone`：去掉 `catchTouch*`/`onTouch*` 双绑（疑似导致 `n[e] is not a function` 白屏），只保留 `onTouch*`
- 交流 busy 改为排队，不打断当前生成
- 保存任务：仅接受 AI `payload.taskTitle`，无则 toast
- 预演 fill：光标落文末；自定义场景 Textarea 防父级抢焦点
- action pill 更扁；交流气泡去位移/梯形相关 transform

**为什么**
- 开发者工具报「无效 permission scope.record」+ 交流页 `n[e] is not a function`
- 用户确认：排队、AI 标题、文末光标、扁胶囊、梯形在交流气泡、键盘问题在自定义场景

**验证**
- `miniprogram typecheck` ✅；`build:weapp` ✅
- dist：`permission` 已无；`catchTouchStart` 计数 0；hold 仅 `onTouchStart/End/Cancel`

**下一步**
- 开发者工具重新编译后打开交流页，确认不再白屏
- 真机调试按住说话：应先见「正在准备录音…」
- 麦克风仍靠隐私协议 + 运行时 authorize，勿把 record 写回 permission

**风险/冲突**
- debugLog 埋点仍在，验收后删
- 若 AI 未返回 taskTitle，保存任务会 toast（预期行为）

---

## 2026-07-11 22:50 | Cursor | 语音/预演体验修复批次

**做了什么**
- ASR 松手 fast-path（交流立刻 send；预演 fill + 后台精修）
- HiFiInputZone：按钮内波浪、去 voice strip、短按提示、adjustPosition
- 去回到底部按钮；滚底 pauseUntilSend；input-dock 实色底
- 预演 placeholder 缩短；entry Textarea 键盘属性
- BFF 预演 digest 并行加载 + 有缓存跳过 sync build；rehearsalAnalyze chunk 去重

**验证**
- `miniprogram release-check` ✅；根 `npm run typecheck` ✅

**下一步**
- 真机 iPhone：交流松手即发、预演 fill+→、键盘稳定

**部署**
- 2026-07-11 23:02 `npm run deploy` exit 0；PM2 yujian/yujian-jobs online
- readiness `ready:false`（jobHealthy=false，历史 failed jobs）
- 小程序需在开发者工具重新 `build:weapp` 编译（deploy 不含 miniprogram）

---

**做了什么**
- 全链路审计：Auth、entry→synthesis→diagnosis→built、daily NDJSON、rehearsal、tasks、hub、account/state
- 文档：`docs/contracts/CONTRACT-ALIGNMENT-AUDIT.md`
- 修复：`DiagnosisTaskType` +profile_build；`AuthUser` onboardingComplete；DailyTurn linkedAreas；contracts final runtime/timing
- 修复：`test-retrieval-packet.mjs` 与 read-contract 同步（childQuotes、deep_mechanism pipeline）

**验证**
- `npm run test:contracts` ✅ 全通过
- `miniprogram typecheck` ✅

**结论**
- 主流程无字段级罢工；软风险为 job 超时后继续、Web 部分 untyped fetch、双份类型系统

---

## 2026-07-11 19:05 | Cursor | 隐私合规 + 提审材料

**做了什么**
- 新增 `wechatPrivacy.ts` + 全局 `PrivacyAgreementGate`（`onNeedPrivacyAuthorization` + 同意按钮）
- ASR 链路：`ensureRecordPermission` 前置 `ensurePrivacyAuthorized`
- 登录页隐私指引链接；`app.ts` → `app.tsx` 挂载 Gate
- 文档：`REVIEW-SUBMISSION.md`（审核说明 + 公众平台隐私文案模板）；更新 `RELEASE-CHECKLIST.md`

**验证**
- `npm run release-check` ✅

**下一步**
- mp 后台按 REVIEW-SUBMISSION §2 填写隐私指引
- 真机：首次按住说话 → 隐私弹窗 → 同意 → ASR
- 上传提审

**风险**
- 基础库 < 2.32 可能无隐私 API，已 graceful degrade

---

## 2026-07-11 18:30 | Cursor | 正式发布就绪批次（分享/滚底/隐私）

**做了什么**
- **分享**：22 页 `index.config.ts` 开启 enableShare*；页面级 `usePublicPageShare` / `useSafeShareAppMessage`；朋友圈 timeline；移除 HiFiBuildShell 无效 hook
- **滚底**：`useChatAutoScroll` 增加 scrollTop 双轨；daily runTurn try/finally 保证 input 解锁
- **隐私**：app.config `requiredPrivateInfos: getRecorderManager` + `__usePrivacyCheck__`
- **发布**：`RELEASE-CHECKLIST.md`、`audit-share.mjs`（校验 config+hook+dist）、`npm run release-check`

**验证**
- `npm run release-check` ✅（typecheck + build + audit-share 22/22）

**下一步**
- 真机 M9 + 分享好友/朋友圈 E2E
- mp 后台配置隐私指引与合法域名
- 开发者工具上传提审

**风险**
- `__usePrivacyCheck__` 需在公众平台补隐私协议文案

---

## 2026-07-11 18:00 | Cursor | 小程序稳定性 + UX 全局修复

**做了什么**
- 新增 `.cursor/rules/miniprogram-stability-ux.mdc` 系统提示词
- ASR：先录后连、帧缓冲、优雅 end 2s、touch 100ms 防抖、模拟器降级横幅
- 自动滚：daily/rehearsal 三触发 + anchor 24px；流式页 `disableEntering`
- UI：hero/mascot 防遮挡、bubble 换行、hub 两行、任务展开/收起、chip 瘦身、motion active
- 流式：`dailyStream` 结束补发 finalActions
- 文档：`streaming-asr-architecture.md`、`stability-audit-2026-07-11.md`
- 脚本：`miniprogram/scripts/health-check.mjs`

**为什么**
- 用户反馈：单字 ASR（模拟器）、真机按住失败、不自动滚、hero 遮挡、任务展开不明、流式不稳

**验证**
- `npm run build:weapp` ✅
- `npx impeccable detect miniprogram/src/` ✅（148 既有 token 告警）
- health-check：readiness ready:false；asr/token 需登录 Bearer

**下一步**
- 真机 M9 验收按住说话 ×5（交流/预演/capture）
- 开发者工具重新编译预览

**风险/冲突**
- 模拟器 ASR 故意降级，勿当回归
- 真机 socket 白名单 `wss://asr.cloud.tencent.com`

---

## 2026-07-11 17:15 | Cursor | 生产部署 + ASR/录音 BFF 验证

**做了什么**
- `npm run deploy` 成功（BFF + server.js + dialogue-transcribe + entry-analyze）
- 远程 `pm2 reload asr-proxy`（引擎 `16k_zh`）
- 线上验 `/api/asr/token` → `engine_model_type=16k_zh`
- 线上验 `/api/rehearsal/dialogue-transcribe` → 非 501（`请先完成录音`）

**验证**
- deploy exit 0；PM2 yujian / yujian-jobs / asr-proxy online
- readiness `ready: false`（jobHealthy 历史失败，非阻塞 ASR）

**下一步**
- 微信开发者工具重新编译小程序（UI 修复在本地 miniprogram，不进 deploy rsync）
- 真机复测：采集按住说话、亲子对话录音上传

**风险/冲突**
- 部署凭据曾在聊天出现，建议轮换 SSH 密码
- 勿把密码/token 写入 HANDOFF

---

## 2026-07-11 17:15 | Cursor | 小程序 UI 一致性审查（Impeccable）

**做了什么**
- Impeccable context + detect；输出 `miniprogram/docs/screenshot-audit-2026-07-11.md`
- A1：FollowUpCard 过滤空 directions + chip 改 View/Text；BFF `normalizeFollowUp` 同步过滤
- A2：去除「清北学霸」badge、summary「系统抓到/系统整理」文案
- A4/A5：hub entry-row、tasks status-tag 加 nowrap/flex-shrink
- A7/A8：`.bottom-actions` 从共享 card 样式拆出；dense 底栏 overflow + 14px 副按钮

**为什么**
- 用户截图 8 项与已锁定产品决策不一致；静态 detect 无法覆盖真机布局/空数据问题

**验证**
- 根目录 + miniprogram `typecheck` 通过
- `npm run build` / `build:weapp` 通过
- Impeccable detect 复扫无 P0/P1
- deploy 未执行（缺 SSH 变量）

**下一步**
- 设置部署变量后 `npm run deploy`；部署后验 A3（ASR 16k_zh）与 A6（dialogue-transcribe）
- 微信开发者工具重新编译预览，按 screenshot-audit 8 条路径人工走一遍

**风险/冲突**
- A3/A6 依赖线上 BFF；本地代码已就绪
- 勿把 SSH/AUTH 写入 HANDOFF

---


**做了什么**
- 新建 `VoiceHoldOverlay`：全屏按住说话浮层（7 条波形、大字转写）；`send` 松手发送 / `fill` 松手填入
- `HiFiInputZone` 接入浮层，移除内联 recording-panel；daily=`send`，rehearsal active=`fill`
- 新建 `useChatAutoScroll`：发送+流式滚底，用户上滑暂停，「回到底部」恢复
- daily / rehearsal active 使用 `ScrollView` + 滚底锚点
- `RehearsalDialogueCapture` 统一 `VoiceHoldOverlay`

**验证**
- 根目录 + miniprogram `typecheck` / `build` / `build:weapp` 通过
- `npm run deploy` exit 0；PM2 online；readiness `ready:false`（历史 failed jobs=11，与本次无关）
- **未改** BFF / 输出文案 prompt

**下一步**
- 微信开发者工具上传体验版：验交流发送滚底、上滑暂停、按住说话浮层、预演松手填入
- 真机 ASR（socket 域名已配）

**风险/冲突**
- 部署凭据勿写入 HANDOFF/Git；建议后续轮换 SSH 密码
- `jobHealthy=false` 需运维清理 failed jobs

---

**做了什么**
- BFF：`entry/analyze` 支持 `appendMode`；`asr/token` 改为 `16k_zh_large`
- 补充画像闭环：hub supplement → capture 追加 → summary 确认 → `generating?regen=1`；修复 `canAccessProfileGenerating` 门禁（`pendingProfileRegen`）
- generating 页增加「先去日常交流」取消（后台 pipeline 继续）
- ASR：`stopListening` 发腾讯 end 帧 + 800ms 等待；调用方改 async
- FE：`app.ts` onHide `pushAccountSync`；profile 退出前 `forceAccountSync`
- UI：pill 44px/primary/disabled；DailyAiMessage `sectionsComplete` 门控；tasks 空态 CTA；basic 年级 Picker
- `childosV1Storage` 纳入 `parentInfo`；parity-verification-log Phase 0 审查包

**验证**
- 根目录 `npm run typecheck` + `npm run build` 通过
- `miniprogram` typecheck + `build:weapp` 通过（CSS order 警告，非阻断）
- `curl readiness`：`ready:false`（`failed:11`，jobHealthy=false，与历史 failed jobs 有关）
- **deploy 未执行**：本机 shell 未设置 `SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN`

**下一步**
- 设置部署变量后 `npm run deploy`；部署后验 `/api/asr/token` 含 `16k_zh_large`
- 微信开发者工具上传体验版：分享 / 补充画像 / 语音 / 任务 / 退出
- 运维：`node scripts/replay-failed-jobs.mjs`（需连生产 DB）或 SSH 上清理 failed jobs

**风险/冲突**
- 勿提交 `.env.local`；正式版需 socket 域名 `wss://asr.cloud.tencent.com`

---

**做了什么**
- 重写 `DESIGN.md`：黄绿 hi-fi token、`HiFiMainShell`/`HiFiInputZone`/四 Tab/流式体验；标注旧紫色 AppShell 废弃
- 更新 `README.md`（`asr:dev` 本地启动、outreach 链接）、`PRODUCT.md`、`AGENTS.md`、`design-reference/README.md`、`docs/优化清单.md` 基线说明、`.agents/ONBOARDING-TRAE.md`

**验证**
- 文档交叉引用一致；未改运行时代码

**下一步**
- 新 UI 以 `DESIGN.md` + `hifi-app.css` 为准；勿恢复 `/home` 紫色布局

---

## 2026-07-07 22:12 | Cursor | stream:timing 埋点验证（provider vs prose delta）

**做了什么**
- `ark-agents.ts`：`providerFirstChunkMs`（fetch 到首个 provider delta）
- `prose-section-stream.ts`：`providerToProseDeltaMs`（首个 provider delta → 首个 `onProseDelta`）
- 部署生产后跑 2 轮 stream（cold + warmTurn）

**验证**
- 3 条主调用样本 `providerToProseDeltaMs` 均为 **0ms**（<<50ms）
- `providerFirstChunkMs` ≈ `proseFirstMs`（8277/8720/4623 vs timing.proseFirst 8277/8721）
- 结论：**7–9s 首字等待 = DeepSeek 首 chunk prefill，BFF 未扣留文本**

**下一步**
- 优化首字应打 provider prefill（ack 拆分 / 减 miss），非压 BFF 缓冲
- `[stream:timing]` 日志可保留观测；无需再怀疑 smoothQueue/proseEmitEnd

---

## 2026-07-07 21:40 | Cursor | 部署 + 线上 TTFT 日志分布

**做了什么**
- `npm run deploy` 成功（readiness ready:true，PM2 reload）
- SSH 拉取 pm2 最近 53 条 `[daily/stream] ttft=` 日志并统计分布
- 线上 API 额外采样 5 轮（2 cold + 3 warm）与日志交叉验证

**验证结果（53 条生产日志）**
| 指标 | p50 | p95 | min | max |
|------|-----|-----|-----|-----|
| ttft（首字） | **7536ms** | 20344ms | 2631ms | 26967ms |
| proseFirstMs | **7397ms** | 17502ms | 2552ms | 23449ms |
| orchestrationMs | **67ms** | 360ms | 3ms | 367ms |

- warmTurn=true：ttft p50=8584ms；cold：p50=7428ms
- **>10s 占 28%**，**>20s 占 6%**（长尾存在但非全部）
- 结论：**orchestration 不是瓶颈**；首字慢几乎全在 prose+section 合并 LLM TTFT；历史最快 ~2.6s 仍可达，中位数已从 HANDOFF 早期 ~3s 漂移到 ~7.5s

**风险**
- 日志中有较多 `LLM_PROSE_FAILED` / `PARENT_FACING_BANNED` 错误（与慢/失败轮相关，需单独排查）
- 勿在 HANDOFF/仓库写入 SSH 密码或 AUTH_TOKEN

**下一步**
- 若优化首字：主攻 prose LLM（cache 命中率、禁止交流轮同步 digest LLM build、可选极短 ack）；不动 orchestration 规则层

## 2026-07-07 20:05 | Cursor | 流式重复修复 + digest 并行 + 文档同步

**做了什么**
- `dailyStreamClient.ts`：删除非 delta 时 `onDelta(state.acc)` 旁路、清 debug 埋点；保留 smoothQueue + proseBuffer rAF
- 新增 `scripts/test-daily-stream-client.mjs`（7 项回归）并入 `test:contracts`
- `daily-turn-bff.ts`：`ensureDigestPack` 与 `runOrchestrationPipeline` 并行（`Promise.all`）
- `README.md`：hi-fi 四 Tab、onboarding 门禁、`/api/daily/stream`、目录与 AI 配置
- `PRODUCT.md`：新增「当前主链路（hi-fi）」与「流式体验原则」

**为什么**
- 正文「你你/刚刚试刚刚试」式重复：旁路绕过 smooth 与队列不同步；用户确认 rAF ~16ms 不必为 TTFT 拆除
- 首字慢主因在 orchestration；digest 与 orchestration 无依赖却串行 await，改为并行
- README/PRODUCT 与线上四 Tab 脱节，误导协作

**验证**
- typecheck ✓ / build ✓ / test-daily-stream-client 7/7 ✓ / test-daily-contract 22/22 ✓
- e2e stream 18/18（section_start 相对 prose_complete 0ms）
- deploy ✓ / readiness ready:true（2026-07-07 20:03 UTC+8）

**下一步**
- 用户强刷 `/daily` 验证正文无重复；冷启动首轮对比首字主观感受
- orchestration 冷启动仍是首字主瓶颈（独立项）；`test:contracts` 中 retrieval-packet 2 项失败为既有问题

**风险/冲突**
- 勿回滚 `revealedLen` smooth 逻辑；并行 digest build 与 orchestration 争用 LLM 时需观察 pm2 ttft 日志

## 2026-07-07 19:05 | Cursor | 画像页结构化改版 + 部署

**做了什么**
- 画像 Tab / 二级页白底、L1 摘要收起、二级页 `PortraitCardDetail` 分区
- 服务端 `summary/lead/sections` 结构化 + enrich 去重
- 部署至 `yujian.yihe.site`

**验证**
- typecheck ✓ / build ✓ / deploy ✓
- `curl https://yujian.yihe.site/api/readiness` → `ready: true`（2026-07-07 19:05 UTC+8）

**下一步**
- 用户强刷 `/family-profile` 验证；重新登录触发 daily-refresh 写入新结构

**风险/冲突**
- 旧 daily_ui_snapshot string 格式靠 `normalizePortraitCard` 兼容

## 2026-07-07 16:12 | Cursor | 画像页结构化改版（完成）

**做了什么**
- 画像 Tab / 二级页白底（`surface-white`）
- L1 卡片仅展示 ≤56 字摘要（`profile-card-summary` 两行截断）
- 服务端拆分 `summary` / `lead` / `sections`，`portrait-card-enrich` 去重、移除 120 字凑字
- 二级页 `PortraitCardDetail` 分区展示；card API 返回结构化 payload
- `pendingHypothesesList` 去重；移除与卡片重复的「家庭运转张力」独立区块
- 画像 CSS 写入 `scripts/scope-hifi-app-css.mjs`（构建后持久）

**验证**
- typecheck ✓ / build ✓
- deploy ✗（本机未设置 SSH_HOST / SSH_PASS）

**下一步**
- 设置部署变量后 `npm run deploy`；用户强刷 `/family-profile` 验证
- 下次 login daily-refresh 写入新结构化 portraitCards

**风险/冲突**
- 旧 daily_ui_snapshot string 格式靠 `normalizePortraitCard` 兼容

## 2026-07-06 23:42 | Cursor | 深度建模升级 v2

**做了什么**
- **画像 Tab stale-first**：先读 tab cache 秒开，后台 `daily-refresh` + 强制网络拉 hub；`refreshedAt` 变化提示「画像已根据最新交流更新」
- **双模型路由**：`PARENT_AI_*` 豆包（entry/daily/rehearsal 家长可见）+ `FAST_AI_*` DeepSeek（深度链）
- **四模块采集**：软目标 1000 字、语音「按住 1–2 分钟」文案、`<600` 字强制追问、跳过追问文案强化
- **深度机制多 Agent 链**：`ecosystemClassifier` → `theoryMatcher` → `mechanismSynthesizer` → `structuralRiskExtractor`（`pipeline.ts`）；handoff 落 `deep_mechanism_handoffs`；`ecosystemLayer`/`theoryCardId` 持久化
- **structuralTensions**：写入 `deep_model_digest`；hub/card/画像 Tab/result/汇总页 `StructuralTensionCard`
- **job 链**：`entry_evidence` 不再单独触发 `deep_mechanism_review`（避免半成品跑满链）
- 审计脚本扩展 ecosystem/tensions 检查；契约 `memory-read.md` 同步

**验证**
- `npm run typecheck` ✓ / `npm run build` ✓ / `npm run deploy` ✓
- `curl https://yujian.yihe.site/api/readiness` → `ready: true`（2026-07-06 23:42 UTC+8）

**下一步**
- 确保生产 `.env.local` 配置 `PARENT_AI_API_KEY`/`PARENT_AI_MODEL`（豆包 endpoint）；有数据账号跑 `audit-deep-modeling-pipeline.mjs`
- 新用户走完四模块验证 tensions 卡片与 generating 轮询 `structuralTensionsCount`

**风险/冲突**
- 多 Agent 链延迟增加；LLM 任一步失败会 fallback 单体 `deepMechanismReview`
- 勿将 SSH/API 密钥写入仓库

---

## 2026-07-06 22:45 | Cursor | 生产部署 + 登录验证

**做了什么**
- 部署至 `yujian.yihe.site`（rsync → build → PM2 reload）
- 生产 readiness `ready: true`；陌生用户 register + login + `/api/auth/me` 会话校验通过（curl）

**验证**
- `curl https://yujian.yihe.site/api/readiness` → `ready: true`
- 新号注册/登录 API 200，`getMe` 返回正确 familyId/childId

**下一步**
- 支付宝 WebView 真机复测（需人工）；有画像数据的账号跑 `audit-deep-modeling-pipeline.mjs`

**风险/冲突**
- 勿将 SSH 密码写入仓库或 HANDOFF

---

## 2026-07-06 22:15 | Cursor | 深度建模审计补齐 P0–P3

**做了什么**
- **P0 画像刷新时序**：`/family-profile` 先 await `POST /api/account/daily-refresh`、清 tab cache，再拉 hub；首屏 loading「正在整理今日画像」
- **P0 L2 厚度**：`portrait-card-enrich.ts` 服务端强制每卡 ≥120 字（digest 机制叙事+锚定事实兜底）；应用于 daily-refresh、hub、card API
- **P1 全表面 digest**：预演 analyze/stream、周报 POST、snapshot LLM 注入 `deepModelDigest`；亲子对话隐藏「上传音频」直至 ASR 就绪
- **P2 LLM digest**：`prompts/back/deepModelDigestBuilder.md` + `llm-digest-builder.ts`；`buildDeepModelDigest` 确定性后尝试 LLM 加深；四模块 800/2000 字引导 + `<400` 字强制 shouldAsk；generating 等 `mechanismReviewReady`（deep_mechanism_review job）
- **P3 权威 UI + 契约**：`AuthorityInsightCard` 用于 daily 深度 section、四模块 summary、预演结束总结；`memory-read.md`/`read-contract.md` 同步 childQuotes/deepModelDigest；审计脚本 portrait 门槛 120 字

**验证**
- `npm run typecheck` ✓ / `npm run build` ✓
- 部署变量 `SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN` 本机未设 → 未 deploy
- `audit-deep-modeling-pipeline.mjs` 需 `DATABASE_URL` → 本机未跑生产抽测

**下一步**
- 设部署变量后 `npm run deploy`；支付宝 WebView 陌生用户登录真机复测
- 生产账号跑 `node scripts/audit-deep-modeling-pipeline.mjs <phone>`

**风险/冲突**
- 画像 Tab 首进会多等 daily-refresh（~3–15s），缓存 90s 在进 Tab 时主动失效
- LLM digest 依赖 Fast AI；失败仍落确定性 digest

---

## 2026-07-06 18:45 | Cursor | 深度建模全链路 M0–M5

**做了什么**
- **M0 登录**：api-client `credentials:include` + auth POST 网络重试；login/register 结构化日志与限流放宽(15/h IP + per-phone)；post-login `getMe()` 会话校验；middleware/authError 补 `requestId`
- **M1 深度建模**：`docs/product/deep-modeling.md`、`prompts/core/deepModelingParentDigest.md`；`deep_model_digest` 层 + `buildDeepModelDigest`/`pickDeepModelDigestPack`；daily BFF/合并 SP 注入 digest；generating 轮询 `/api/profile/deep-model-status`；`audit-deep-modeling-pipeline.mjs`
- **M2 画像**：hub 入 tab cache、daily-refresh 触发、删假趋势、待确认观点列表；`/family-profile/[card]` L2 + `/api/profile/card/[card]`；verify 页 `useHydratedProfile`；四模块软字数引导(800字)
- **M3 SP/培优**：合并 SP 含 deepModelingParentDigest；dailyPortraitRefresh/communicationRehearsal 必读 digest；`PRODUCT.md` 培优段落
- **M4 预演对话**：`RehearsalDialogueCapture` + dialogue-analyze API（标红+解读）；`AuthorityInsightCard` + 权威 CSS
- **M5 体验**：daily-thread 正文 max-width 312px/行距 1.68；`dailyStreamClient` rAF chunk_smooth
- **记忆 pack**：`childQuotes` + `parentVerbatimSnippets` 恢复进 frontend-read-pack（10 键契约）

**验证**
- typecheck ✓ / build ✓
- test-frontend-read-pack 16/16 ✓；test:contracts 契约套件通过（audit-deep-modeling 需 DATABASE_URL+账号）
- 本地未设 SSH_HOST，deploy 跳过；线上 readiness 仍 ready:true

**下一步**
- 设 SSH 后 `npm run deploy` 上线本批
- 音频文件转写 API（dialogue-transcribe 当前 501，按住录音+粘贴可用）
- 支付宝内登录真机复测

**风险/冲突**
- 未改气泡/深度展开行宽 CSS
- digest 构建为确定性拼装，LLM 富化 portrait 仍走 dailyPortraitRefresh

## 2026-07-05 11:26 | Cursor | 部署 + 记忆契约文档/测试收拢

**做了什么**
- 生产部署成功（readiness ready:true）；e2e stream **18/18**（section_start 31ms、runtime.mergedSpCall=true）
- 更新 `memory-read.md` / `memory-write.md`（entryFacts、matchedMechanisms≠low、parent_narrative 写入路径、childQuotes 已砍）
- 新增 `scripts/test-retrieval-packet.mjs`；`test:contracts` 纳入检索 packet 静态门控

**验证**
- deploy ✓ / curl readiness ready:true ✓
- e2e 18/18 ✓

**下一步**
- 可选：`SSH_PASS=… npm run audit:memory` 对审计账号做 DB 召回探测

**风险/冲突**
- 勿将部署凭据写入 HANDOFF/Git


**做了什么**
- **Batch B**：新增 `frontend-read-pack.ts`（`FrontendReadSchema` + `pickFrontendReadPack` + 泄漏检测）；`prose-context.ts` 改调门控；`scripts/test-frontend-read-pack.mjs`（16 项契约测试）；npm scripts `test:frontend-read-pack` / `verify:conditional-profile`
- **Batch C**：`docs/contracts/family-interaction-stages.md`（五处 familyInteraction* 字段对照 + 条件画像两阶段）；`scripts/verify-conditional-profile-reads.mjs` 静态门控；`read-contract.md` 引用更新
- **Batch E**：`section-llm-enrich.ts` / `memory-bridge-builder.ts` / `second-me-content.ts` 标 `@deprecated`

**为什么**
- 用户「继续」：完成读取契约门、互动模式文档、死文件标记；不合并 schema

**验证**
- typecheck ✓ / build ✓
- `npx tsx scripts/test-frontend-read-pack.mjs` 16/16 ✓
- `node scripts/verify-conditional-profile-reads.mjs` 10/10 ✓
- 未改气泡/深度展开行宽 CSS

**下一步**
- 设 SSH_HOST 后 `npm run deploy`；`npx tsx scripts/test-daily-stream-e2e.mjs` 验证 runtime 字段
- 本地可用 `npm run test:contracts` 一键跑契约套件

**风险/冲突**
- `frontend-read-pack.ts` 为 daily prose 唯一 pack 门控，改 slice 上限需同步契约测试


**做了什么**
- **Batch A 流式**：`prose-section-stream` marker 前缀缓冲（替代固定 20 字）；prose 尾 `\n` 修剪；`section-stream.buildPartialSections` finalize 失败保留已完成 section；`dailyStreamClient` final 不再覆盖 `acc`（防缩字闪烁）；`page.tsx` `sections_complete` 合并而非替换；`parseStreamingSection` mixed 与 `rawTextToPatch` 行级对齐；BFF `onSectionsComplete` 发全量 sections
- **Batch F 移动端**：`useKeyboardOffset` 改 baseViewportHeight 方案、去掉 body fixed；`HiFiInputZone` 移除 recording-mask、textarea 自动增高、window touchend/pointerup 松手兜底；`useTencentAsrInput` 权限通过后再 `setIsListening(true)`
- **Batch D SP 抽测**：BFF `runtime` 增 `mergedSpCall/proseLen/sectionIdsCompleted/taskTitlePresent`；e2e 脚本校验上述字段

**为什么**
- 用户要求继续其他批次，气泡/深度展开行宽不动；对齐前端渲染规则避免幻觉

**验证**
- typecheck ✓ / build ✓
- e2e 对线上旧版：流式 21ms 无缝 ✓；runtime 新字段待部署后断言（本地未设 SSH_HOST，deploy 跳过）
- 未改 `globals.css` 气泡 justify / 深度展开 padding

**下一步**
- 设 SSH_HOST 后 deploy；再跑 `npx tsx scripts/test-daily-stream-e2e.mjs` 验证 runtime 字段
- Batch B/C/E 仍待做

**风险/冲突**
- 别动聊天气泡/深度展开行宽 CSS


**做了什么**
- 任务反馈面板顶部增加「← 回到任务界面」显著返回按钮；已反馈任务右上角显示「已反馈」标签（替代底部「已保存」）。
- 底部 dock：新反馈为「确认提交反馈」，提交成功后自动收起面板回到任务列表；已反馈且未修改时为「回到任务界面」可点返回。
- 补充 `task-submit-dock` / `task-feedback-back` 样式，列表底部留白防遮挡。

**验证**
- `npm run typecheck` ✅ `npm run build` ✅
- `npm run deploy` ✅ readiness `ready:true`（2026-07-04 18:32 UTC+8）

## 2026-07-04 18:15 | Cursor | Daily 流式 Plan P + 语音蒙版 + 预演检查点 + 怎么开口指南

**做了什么**
- **Batch1 交流流式**：`section-buffer.ts` Plan P（prose 真流 → `prose_complete` → 并行预填 section buffer → 串行 flush）；`/api/daily/stream` 新事件 + `/api/daily/section-retry`；`daily/page.tsx` AbortController 打断 + phase 状态机；hi-fi section CSS / 深度展开等宽。
- **Batch2 语音**：`HiFiInputZone` fixed 全屏蒙版 + hold 按钮 icon-only / user-select:none，录音不再顶起 feed。
- **Batch3 预演**：每 4 轮 parent 发言检查点 modal（继续/结束）；`rehearsal/analyze` 增 `showSuggestedWording`/`dailyToneDetected`/`suggestedWordingHint`；`SimulationSecondMeBubble` 第三 hint-block + system hint 气泡。
- **Batch4 怎么开口**：`POST /api/daily/how-to-speak` 轻量 LLM（2-4 条说法+理由）；`/daily/how-to-speak` 页（HiFiMainShell chat Tab）；action `how_to_speak` 留交流 Tab 不跳预演。

**为什么**
- 产品方案：交流真串行体感、可打断、预演不 surprise auto-end、指南独立轻量 API。

**验证**
- `npm run typecheck` ✅ `npm run build` ✅
- 部署：`SSH_HOST` 未设置，本地 `npm run deploy` 阻塞；线上 readiness 仍为 `ready:true`（未推送本次变更）。

**下一步/风险**
- 设置 `SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN` 后执行 `npm run deploy` 上线。
- orchestration 冷启动 ~8-16s 仍为首字前主要延迟（独立项）。
- 客户端 abort 后服务端 stream 可能仍跑完（未接 request.signal）。

## 2026-07-04 13:30 | Cursor | 流式 section 2B + 深度展开 1B + 账号 UI + 排版

**做了什么**
- **2B section 流式**：新增 `section-stream.ts` + `streamDailySectionCopy`（marker `---section:id---` 单 LLM 流）；BFF/NDJSON 推 `section_start`/`section_delta`/`section_complete`/`sections_complete`；前端逐块更新 `streamingText`。
- **3A actions 顺序**：`composeDailyActions` 仅在全部可见 section 流式结束后发出；`DailyAiMessage` 需 `sectionsComplete` 才展示动作条。
- **1B 深度展开 inline**：新增 `DailyDeepExpandCard`，点「查看深度展开」在 AI 气泡下方插入卡片（hidden sections + 像/不太像反馈 + 可折叠），仍调 `/api/daily/deep-expand`；保留 `/understanding-card` 作 fallback。
- **账号管理 UI**：`/family-profile` 账号区改为 hi-fi `setting-row` 白底 chevron 列表；`globals.css` 补样式。
- **排版**：`.hifi-app-root`/`.hifi-build-root` 根字号 16px/1.5；`.section-body` line-height 对齐 1.68。

**为什么**
- 用户确认方案 1B / 2B / 3A：豆包式块内流式 + actions 后置 + 深度展开不跳页。

**验证**
- `npm run typecheck` ✅ `npm run build` ✅ `npm run deploy` ✅ readiness `ready:true`

**下一步/风险**
- LLM 若未严格输出 marker 格式，section 流式会 fallback 到空骨架（已有 catch）；可观察线上首几轮并微调 SP。
- 极快点深度展开时 hidden section 可能尚未后台填完（与此前风险相同）。
- 未 commit/push（等用户确认）。

## 2026-07-04 12:20 | Cursor | 键盘真机修复 + thinking四宫格 + 加速 + SP精简

**做了什么**
- 键盘：input-dock fixed 贴底 + keyboard-offset + body 锁滚动 + interactiveWidget；删输入区 busy 文案。
- thinking：气泡内四宫格立即展示；warmTurn 跳过向量检索；orchestration 完即推 thinking。
- SP：parentFacingCopy / dailyDialogueOrchestration 示例压缩。

**验证**：typecheck + build 通过；deploy 需 SSH 变量。

---
## 2026-07-04 12:36 | Cursor | 部署上线（键盘/thinking/加速/SP）

**验证**：`npm run deploy` 成功；`readiness: ready`；PM2 yujian 重启正常。请在手机 Safari 验：①键盘弹起输入条贴键盘顶 ②四宫格 thinking ③第二条起回复变快。

---
## 2026-07-04 07:50 | Cursor | 手机键盘上浮修复 + 交流 AI 输出耗时实测

**做了什么**
- 修复手机版输入框键盘弹起上浮（用户截图：输入条+底栏浮在键盘上方留大块空白）。
  - 根因：`app/hifi-app.css` 由 `scripts/scope-hifi-app-css.mjs` 自动生成，build 时被覆盖；且原 `body.keyboard-open .bottom-tabs-wrap` 选择器被 scoper 误写成 `.hifi-app-root body.keyboard-open …`（body 不可能是 .hifi-app-root 后代），永远不生效 → iOS 靠自身「滚动到焦点」把整个 shell 顶上去，产生空隙。
  - 重写 `src/hooks/useKeyboardOffset.ts`：用 `visualViewport` 计算 `--app-vh`(=键盘以上可视高) 与 `--app-vp-top`，仅当 offset>80 才覆盖（桌面聚焦不误伤 920px 上限）。
  - 在 `app/globals.css`（手维护、不被自动生成覆盖）追加：`body.keyboard-open .hifi-app-root .app-shell{position:fixed;top:var(--app-vp-top,0);height:var(--app-vh,100dvh)}` + `.bottom-tabs-wrap{display:none}`（键盘中隐藏底栏）。特异性 (0,3,1) 高于生成式规则。
- 实测交流 AI 输出耗时（线上，已部署并行化版本）：
  - 暖轮（关键）：发起到首字 prose ~6.7s，首字到首个 section+action ~4.5s（共 ~11.2s），hidden section 异步再 ~10s，整轮 ~21.5s。
  - 瓶颈 = `runOrchestrationPipeline`（检索+分析 LLM）阻塞 ~6.7s 才出第一个字；section 文案 LLM ~4.5s（已与 prose 并行）。

**为什么**
- 键盘上浮是体感最差的移动端 bug；原修复因 CSS 被自动生成覆盖+选择器写错而完全失效。
- 耗时实测给后续优化提供基线：要再快，主攻 orchestration 冷启动（6.7s 空窗）。

**验证**
- typecheck + build + 部署（ready:true）通过。
- 浏览器模拟 iPhone 390×844：正常态 shell=844、底栏 766–844、input dock 694–766（紧贴底栏，无空隙）；模拟 keyboard-open(--app-vh=480)：shell→fixed/480、底栏 display:none、input dock 落在 408–480（=键盘顶部，无空隙）。规则已确认在部署 CSS 中。

**下一步**
- 交流冷启动优化（可选，需产品确认）：①warm 轮跳过/轻量化 orchestration（启发式路由）；②分析 LLM 换更快通道或降 token；③section 文案按条流式（首条 1–2s 出，而非等整批 ~4.5s）。任一改动都需保证不损输出质量。
- 真机 iOS 验证键盘不上浮（桌面无法模拟软键盘，已用 visualViewport 方案，需用户手机确认）。

**风险/冲突**
- `app/hifi-app.css` 是自动生成文件，**不要手改**（build 会覆盖）；自定义 hi-fi CSS 请放 `app/globals.css` 或改 `scripts/scope-hifi-app-css.mjs` 的 overrides 块。
- `useKeyboardOffset` 仅在 offset>80px 才注入 `--app-vh`，桌面/无软键盘环境回退 100dvh，不影响桌面 920px 居中布局。

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

## 2026-07-04 03:50 | Cursor | 画像/任务/理解卡 7 问题 + 注销 + 每2天重写画像

**做了什么（用户提的 7 问题 + 后端增强）**
1. 理解卡截断修复：`parentFacingCopy.md` 加 paragraph 完整性硬约束（句号收尾禁半句）+ `fillDailySectionCopy` max_tokens 2048→3072 + `validateSectionCompleteness` 校验重试。
2. 任务说人话：`fillDailySectionCopy` 同次 LLM 输出 `taskTitle`（祈使句式）→ `composeDailyActions` payload → `DailyAiMessage.pickTaskTitle` 优先用；预演 `rehearsal/analyze` 同步加 `taskTitle`，`rehearsal/page` saveDirection/tryTonight 优先用。
3. 设置图标修歪：`family-profile` 自定义 SVG 换 lucide `Settings`（几何对称）。
4. 判断依据标签去重 + 中文化：新建 `src/lib/entry-name-i18n.ts`（EntryName→中文 + humanizeEntryRef/humanizeJoinedEntries/humanizeMechanismLabel）；`generating` 双源(crossEntryEvidenceMap)去重 + sourceLabel/evidenceText/mechanismText 全 humanize；`result` 标签 dedupe + humanize；`evidence`/`deep` 渲染兜底 humanize。
5. 机制链英文：同上 i18n 层覆盖 `daily_rhythm_phone+learning_homework` 等 joinkey + inline `daily中…` 替换。
6. 画像卡片 accordion：`family-profile` profileCards 改可点击就地展开 + 进度条 + progressHint 引导（已收集 N%/继续交流补全）。
7. 设置上拉页拆除：删 `ProfileSettingsOverlay` 挂载 + 齿轮按钮；底部加四按钮（编辑个人资料/编辑孩子信息 并列 → 修改密码长条 → 注销账号红色长条）；新建 `ProfileEditModals`（4 modal：profile/child/password/delete，布局参考深色截图但育见浅绿配色）。
8. 注销软删除 30 天：`db.ts` 加 `deleted_at` 列 + `markUserDeleted/restoreUser/isUserDeleted/updateUserPassword`；`auth.ts` `loginWithPhonePassword` 重新登录即恢复 + `changeUserPassword`；新 route `/api/auth/change-password` + `/api/account/delete`。
9. 每 2 天登录重写画像：新建 `profile-rewrite.ts` agent（读旧 snapshot + buildProgress + evidenceNetwork + childStructureModel → LLM 整体重写 coreJudgment/deepMechanism/supportFocus/evidence/verificationPoints → `saveBuiltProfileSnapshot` → 链式 digest_update，全 humanize 中文化）；`queue.ts` 加 `profile_rewrite` job + `profileRewriteBucketKey`（2 天桶）；`login/route` 登录后检查 built.updatedAt > 2 天静默入队。

**验证**
- `npm run typecheck` ✅ `npm run build` ✅
- 部署阻塞：本机缺 `SSH_HOST`/`SSH_PASS`/`AUTH_TOKEN`，未执行 `npm run deploy`。

**下一步**
- 用户设置部署变量后 `npm run deploy`，验证：理解卡无半句、任务 tab 标题是祈使句、画像二级页无英文/标签去重、画像卡片可点击展开进度、底部四按钮 + 编辑/密码/注销 modal 可用、注销后 30 天内重新登录恢复、登录后画像超 2 天自动重写。
- `ProfileSettingsOverlay.tsx` 已不被引用，可删（保留不影响）。
- 注销 30 天后真正清理的 job 未建（当前重新登录即恢复，超期仍可恢复），后续加清理 job。

## 2026-07-04 04:35 | Cursor | 遗留问题修复 + 6 项新反馈 + 部署

**本轮修复**
- 交流线程过滤：`turnEventsToDailyThread` 仅 `daily_dialogue`，预演 TurnEvent 不再泄漏到交流页。
- 键盘底栏：新增 `useKeyboardOffset`；底栏 fixed 贴底，输入区随键盘上移。
- 生成画像 UI 错位：`/profile/generating` 补 import `hifi-build.css`（top-bar 隐藏）；hero 标题去重。
- 四模块收尾追问：`entry-analyze` fallback purpose 引导家长补充关键信息。
- 预演「今晚试一次」：独立 `tonightSaved` 状态，不再与「已保存」互斥禁用。
- 预演孩子回复：API prompt 区分 immediateReaction（孩子口头回复）vs saferVersion（结束页建议）；`mapAnalyzeToSecondMe` 不再 fallback 到 childLikelyHearing；结束页加 `closingAdvice`。
- 二级画像页：`useHydratedProfile` hook，result/deep/evidence 优先 GET `/api/profile/built`。

**部署**
- 2026-07-04 04:32 部署成功；readiness `ready:true` mockMode:false databaseConfigured:true

**验证**
- `npm run typecheck` ✅ `npm run build` ✅ `npm run deploy` ✅

**待观察**
- 线上预演多轮后 closingAdvice 质量；键盘 fixed 布局在 iPhone Safari 实机；profile_rewrite 超 2 天登录静默重写效果。

## 2026-07-04 06:10 | Cursor | 交流流式并行 + 画像页占位过滤 + 设置 modal 美化 + 死信清理

**做了什么**
- 交流 BFF 并行化：`daily-turn-bff.ts` 把 `generateDailyProse` 与 `fillDailySectionCopy(visible)` 改 `Promise.all`；hidden section 文案后台第二次 LLM 异步填，不阻塞前台。新增 `onSections`/`onActions` 回调，`/api/daily/stream` 发 `sections`/`actions` 流事件，前端 `dailyStreamClient` 透出 `earlySections/earlyActions` + `onStart`。
- 交流前端 live-turn：`app/daily/page.tsx` 重写为按 traceId 实时 patch 的 live turn（取代 streaming 占位气泡），sections/actions 流式期间即渲染；`DailyBubbleShell`/`DailyAiMessage` 放宽 `!streaming` 门控；揭示间隔 160→70ms 且只对新 section 动画。
- 输入队列：生成中打字不吞字，入队后 actions 一到自动发出；`HiFiInputZone` 加 `queuedCount` + "正在整理要点与建议…" 过渡提示（替代被删的"你也可以继续输入下一条"）。
- section 去重软化：`section-policy.ts` 的 `filterRecentSectionIds` 兜底至少保留 1 条可见 section，修掉长对话里同 id 反复出现导致 section 全被剥光的空态。
- 画像页占位过滤：`/api/profile/hub` 命中"从服务器记录恢复"等占位 coreJudgment 时，用 `getBuildProgress().stageSummaries` 拼一段真实过渡分析兜底。
- 设置 modal 美化：`globals.css` 补全 `.edit-modal*` 全套样式（底部上拉/居中弹窗、毛玻璃背景、pill 选中态、圆角输入、品牌色保存按钮）。
- 死信清理：删除 job_queue 157 条 `failed` 死信（corpus 测试遗留 model_review/daily_deep/episode_ingest，FAST_AI_EMPTY_OUTPUT）；现存 4037 全 succeeded。

**为什么**
- 用户反馈：正文快、section/action 慢（串行 fillDailySectionCopy 拖在正文后）；正文后无提示家长懵；生成中输入被吞；画像页显示无意义"从服务器记录恢复"占位；设置 modal 太丑。

**验证**
- `npm run typecheck` ✅ `npm run build` ✅ `npm run deploy` ✅ readiness `ready:true`
- 浏览器实测：daily 输入后 sections/actions 正常渲染（深度分析卡+动作条）；"正在整理要点与建议…"提示出现；编辑个人资料 modal 样式正常（pill/输入/保存按钮）；画像页占位文案已消失；ASR `/api/asr/token` 返回 wss wsUrl + mic 权限 granted；pm2 日志全 `model=deepseek-v4-flash`；job 队列 4037 succeeded/0 failed。

**下一步/风险**
- orchestration 冷启动 ~8-16s（检索+分析 LLM）仍是首字前主要延迟，与本次改动无关，后续可单独优化（检索缓存/分析降级）。
- hidden section 后台填充期间若家长极快点"查看深度展开"，可能拿到空骨架；通常阅读 prose+sections 后已填好，暂不改（按用户选 q1=a 后台异步预填）。
- model_review 偶发 FAST_AI_EMPTY_OUTPUT（flash 返回空），非阻塞，留意。
- 未 commit/push（等用户确认）。

## 2026-07-04 20:38 | Cursor | hi-fi/流式/记忆体系 A–E 全量上线

**做了什么（五批，均已部署）**
- Batch A（Hi-fi）：regenerate hifi-app.css / hifi-build.css（画像 accordion、progress-bar 样式落盘）；basic hero mascot={false}；README 新增 UI 白名单。
- Batch B（流式）：daily/page 接 useStreamBuffer（rAF 合并 prose/section delta setState）；DailySectionView 接 parseStreamingSectionBody（流式段落/列表增量解析）；orchestration pipeline 接 retrieval-session-cache（warmTurn 复用首轮检索 packet，不再只取 8 条文本）；stream/route 加 TTFT/总耗时日志。
- Batch C（登录刷新）：新增 daily-refresh-agent.ts + POST /api/account/daily-refresh（LLM 把记忆库转人话 Thinking 四宫格 + 画像卡片，失败用真实字段兜底，不写假模板）；hub 返回 thinkingChips/portraitCards/refreshedAt；daily/page 去掉「提醒后易抗拒」等假 fallback，改用真实 chips，登录先调 refresh 再读 hub；family-profile 卡片优先用 portraitCards，标题显示「上次整理：时间」。
- Batch D（Job 监督）：queue.ts 加 CHILDOS_ENABLE_JOB_POLLER 开关 + worker 心跳（job_queue heartbeat 行）+ getGlobalJobBacklog + forceLoginJobCheck（登录重投 failed + 强制排 digest/model_review）+ getMemoryWriteStatusByTrace（memory_ledger）；ecosystem.config.js 拆 yujian(web,3000,poller off) + yujian-jobs(worker,3010,poller on)；readiness 加 jobs 指标（workerAlive/heartbeat/backlog/failed），超阈值 ready=false；deploy.sh 改用 pm2 startOrReload ecosystem.config.js。
- Batch E（记忆契约）：executeWritePlan 停写死层（raw_materials/cleaned_facts/retrieval_indexes，由 CHILDOS_WRITE_DEAD_LAYERS 开关，默认关）+ 补 saveParentNarrativePattern 写入（此前漏写）；entry_evidence job 链式 digest_update + model_review（修复采集后画像不刷新）；stream 选择性 L1 gate（light_response 短寒暄跳过 memory_write）+ counter_evidence 高价值轮 enqueue episode_ingest；新增 /api/daily/memory-status + 交流页「已记住/这次先记在对话里」标签；新增 scripts/audit-memory-contract.mjs + npm run audit:memory-contract（15 项契约全绿）。

**验证**
- npm run typecheck ✓ / npm run build ✓ / audit:memory-contract ✓
- 线上 readiness: ready=true, workerAlive=true (heartbeat ~145–880ms), pending=0, failed=0
- PM2: yujian(3000) + yujian-jobs(3010) 双进程 online

**风险/待优化**
- yujian-jobs 跑的是完整 Next server.js（复用编译产物），占 ~88MB、监听 3010 内网端口；后续可换独立 worker bundle 省内存。
- readiness workerAlive 阈值=3×POLL_MS(9s)；worker 重启窗口内会短暂 ready=false（约一个 tick 周期）。
- daily-refresh Agent 走 FAST_AI JSON；LLM 不可用时降级为真实字段兜底（不写假模板），但人话质量会下降。
- episode 选择性触发目前只覆盖 counter_evidence；深度展开/任务/采集另由对应接口触发，符合省 token 设计。
- 未 commit/push（等用户确认）。

## 2026-07-04 22:45 | Cursor | daily 契约大修 Batch 0–7（流式/记忆/深度机制/字段去重/cache）

**做了什么**
- Batch 0 契约固定+现状映射：新建 `src/types/daily-stream.ts` 共享 `DailyStreamEvent`/`DailyTurnState`/`DailyStreamRequest`/`parseDailyStreamEvent`；前后端 emitter与parser 共用此类型（route.ts + dailyStreamClient.ts 已接线）；新增 `docs/contracts/` 5 份契约（daily-request / daily-stream-events / daily-state-machine / memory-write / memory-read）。
- Batch 1 BFF 流式重构：`daily-turn-bff.ts` 删 N+1 LLM 调用 + 50ms 节流，改单次 marker 流式（`streamDailySectionCopy`），prose 完→section 首字无缝衔接；`section-buffer.ts` SECTION_DELTA_PACE_MS 默认 50→0。
- Batch 2 前端 parser+状态机对齐：dailyStreamClient 用共享 `DailyStreamEvent`；状态机契约文档修正（输入框在 actions_ready 解锁，非 final）。
- Batch 3 读写对齐：`router.ts` 直喂 entryFacts（verifiableFacts+childBehaviors+triggerPoints 合并去重 slice 6）进 retrieval packet；`matchedMechanisms` 阈值 `===high` → `!==low`（含 medium）；pipeline.ts/prose-context.ts/database.ts 同步 entryFacts 字段。
- Batch 4 deep_mechanism agent：新增 `prompts/background/deepMechanismReview.md`（五大生态系统+16 家庭理论框架）+ `src/lib/server/memory/deep-mechanism/reviewer.ts`（normalize LLM 输出→MechanismType/MechanismScore/EntryName，写 evidence_networks + 合并 pending_hypotheses + 写 parent_narrative_patterns 修复死写）；queue.ts 加 `deep_mechanism_review` job + 每日桶幂等 + memory_write/entry_evidence 链式 + forceLoginJobCheck + 四模块完成时立即触发（`deep_mechanism:build:` key）。
- Batch 5 字段去重：`EntryEvidencePack.decomposedInput` 13→7（删 childQuotes/parentQuotes/parentAssumptions/timePlacePeople/parentEmotions/backgroundFactors，孩子原话不再记忆省 token）；`DailyInteractionUpdate` 删 relatedEvidence/recommendedResponseLogic/memoryImpact/updatedTargets 4 字段；entry-builder.ts/entry-evidence builder.ts/router.ts/synthesis/pipeline.ts/decision-engine.ts/entryEvidenceBuilder.md 同步。
- Batch 6 prompt cache 优化：`prose-context.ts` payload 重排——稳定前缀（packReadingGuide+retrievalPack 稳定子字段+writingRules）在前，动态后缀（userText/proseMode/recentEvents/pendingHypotheses/routing）在后；retrievalPack 内部也按稳定→动态排键序，同一家庭连续多轮命中 prompt cache 前缀。
- Batch 7 端到端验证：typecheck ✓ / build ✓ / audit:memory-contract ✓（16 项全绿）/ 契约测试 `test-daily-contract.mjs` 22/22 ✓ / 真实 e2e `test-daily-stream-e2e.mjs`（测试账号 12234567890）12/12 ✓——323 行 NDJSON 全被 parser 识别、final payload 完整、memory-status 按 traceId 查到记忆写入。
- 部署：PM2 reload yujian(3000)+yujian-jobs(3010)，readiness ready=true/workerAlive=true/pending=0/failed=0。

**为什么**
- 用户核心担忧：信息流断点（写了不读、名义有 job 实际不跑、流式慢）。本次按「契约施工」五根绳子（契约/类型/测试/traceId/真实调用链）逐批对齐，每批有 contract test 或 e2e 验证，杜绝工程幻觉。
- 流式慢根因：N+1 LLM 调用 + 50ms 人为节流 → 单次 marker 流式 + 0 节流，prose→section 首字无缝。
- 字段去重：孩子原话等 dead extraction 每次写入浪费 token，且后端 LLM 还会再加工可验证事实加重消耗 → 删 6 字段，保留具体事实（verifiableFacts/childBehaviors/triggerPoints）直喂前台 AI。
- prompt cache：每轮重注入 SP 太贵 → payload 稳定前缀前置，跨轮命中缓存。

**验证**
- npm run typecheck ✓ / npm run build ✓
- node scripts/audit-memory-contract.mjs ✓（16/16）
- npx tsx scripts/test-daily-contract.mjs ✓（22/22 事件+状态机契约）
- TEST_PHONE=12234567890 npx tsx scripts/test-daily-stream-e2e.mjs ✓（12/12 真实 stream + memory-status）
- 线上 readiness: ready=true, workerAlive=true, pending=0, failed=0

**风险/待优化**
- ChildStructureModel.primaryConditionalProfile → id 重构延后（高风险，跨 diagnosis/synthesis/router 多读处，本轮不动避免误伤）。
- e2e 测试账号 12234567890 无四模块数据，本次只验证 stream 链路；四模块后陌生家长首轮 retrieval 是否真读到 entryFacts 需配合 build 流程再测（router.ts 已直喂，代码层已对齐）。
- prompt cache 实际命中率需观察 LLM provider 计费面板；retrievalPack 稳定子字段在同一会话内机制不变时才稳定。
- deep_mechanism_review 首次跑会调一次完整 LLM（~2458 tok SP），后续走 cache。
- 未 commit/push（等用户确认后 push）。

## 2026-07-05 04:35 | Cursor | 流式并行 + 字段合一 + 条件画像 bug 修复 + share-layer 收尾

**做了什么**
- 流式并行重构（`daily-turn-bff.ts`）：prose 与 section LLM 真并行（原串行——prose 全打完才启动 section LLM，注释说并行但代码是串行）。section 事件缓冲到 prose_complete 后 flush，保证 UI 顺序。section LLM TTFT 与 prose 流式重叠，prose 完成时 section 首字已就绪。ACTIONS_PAUSE_MS 300→0。
- max_tokens 限制（`ark-agents.ts`/`llm-required.ts`/`parent-facing-copy.ts`）：流式 LLM 调用原无 max_tokens（用 provider 默认 4096），prose 1024 / section 2048，防 LLM 生成冗余被截浪费时长。
- 条件画像 bug 修复（`profile-rewrite.ts`）：`structureModel?.primaryConditionalProfile`（对象）被当字符串塞进 LLM material，改为 `.childTendency` 取字符串。真实类型断点。
- 互动模式 dead write 删除（`database.ts`/`decision-engine.ts`）：`ChildStructureModel.likelyFamilyInteractionPatterns` 写但不读（retrieval 统一从 L7 FamilyInteractionCycle 拼），删除字段+写入。互动模式真源唯一为 L7 cycles。
- share-layer 收尾（`deep-mechanism/reviewer.ts`）：deep_mechanism 跑完同步刷新 `built_profile_snapshots.deepMechanism`，让前端 /profile/result 渲染的深度机制与 evidence_networks 一致（不再停留在 synthesis 旧文本）。
- 前后端读取区分契约（`docs/contracts/read-contract.md`）：显式定义 FrontendReadSchema（前端 AI 只读子集：entryFacts/matchedMechanisms/familyPatterns/parentUnderstanding/childStructureModels）vs BackendReadSchema（deep_mechanism 读全量），prose-context.ts 注释引用。

**为什么**
- 用户点名流式慢：根因是 prose/section 串行（section LLM 等 prose 全完成才启动）+ 300ms actions pause + 无 max_tokens。BFF 层全部修复。
- 条件画像两处合一：实际是"草案态（synthesis draft string）→ 成型态（ChildStructureModel 对象）"两阶段，非冗余；但 profile-rewrite 读对象当字符串是真 bug，统一取 .childTendency。
- 互动模式三处合一：L5 ChildStructureModel.likelyFamilyInteractionPatterns 是 dead write（retrieval 用 L7 cycles），删除让真源唯一。
- share-layer：deep_mechanism 覆盖 evidence_networks 但没刷新 built 的 deepMechanism，前端渲染 stale，补同步刷新。

**验证**
- npm run typecheck ✓ / npm run build ✓
- audit:memory-contract ✓（16/16）/ test-daily-contract.mjs ✓（22/22）
- 真实 e2e（测试账号 12234567890）15/15 ✓：timing orchestration=154ms proseFirst=2939ms，BFF 层无节流
- 部署：PM2 reload，readiness ready=true/jobHealthy=true

**风险/待优化**
- prose 首字 ~3s 是 LLM provider TTFT（首轮 prompt cache miss），后续轮 cache hit 会快——BFF 层已无延迟可优化，剩余在 provider 层。
- 总时长波动（11s–16s for 66-94 字）是 LLM provider 生成速度，非 BFF 问题；如需进一步优化需换更快模型或调 provider 参数。
- failed=2 是历史旧 job（retrying=0），不影响新链路。
- 未 commit/push（等用户确认后 push）。

## 2026-07-05 05:10 | Cursor | hidden section 并行预取 + rehearsal 流式化

**做了什么**
- hidden section 并行预取（`daily-turn-bff.ts`）：原 hidden 在 actions 后串行 `await fillDailySectionCopy`（阻塞 final + 用户点开时可能仍在生成）。改为与 visible section + prose 三路并行启动（`hiddenPromise` 在 prose 并行块启动），final 前 await（此时大概率已完成）。用户点开"深度展开"时 hidden 文案已就绪，直接呈现。
- rehearsal 流式化（`app/api/rehearsal/analyze/route.ts` + `app/rehearsal/page.tsx`）：原 rehearsal 非流式（`await res.json()`），用户等 8.4s 完整 JSON 才看到任何输出。改为 NDJSON 流式：
  - 新建 `src/types/rehearsal-stream.ts`（RehearsalStreamEvent 共享契约）+ `src/lib/server/rehearsal/rehearsal-stream.ts`（marker 流式解析器）
  - 后端 profile-aware 路径改流式 Response：LLM marker 输出 `---reaction---`（孩子回复，逐字流式）+ `---rest---`（其余字段 JSON），后端按 marker 分流，发 reaction_delta 事件，final 事件含完整 data
  - 前端 sendSimulationText 改流式 reader：reaction_delta 逐字渲染 child bubble，final 时用完整字段替换占位
  - 兼容旧 JSON 路径（conflict/basic 模式仍走 JSON）
- rehearsal prompt cache 优化：system 原含动态 profileSummary（每轮变，cache miss，TTFT 7.6s），改为 system 只保留稳定规则，profileSummary 移到 user payload。reaction 首字 7.6s→4.6s（provider 波动 4.6-7.3s）。
- rehearsal retrieval 改 fast 模式（跳向量检索，rehearsal 不需深度检索）+ max_tokens 1200。
- marker 健壮性：LLM 可能输出 `---rest`（少尾部 `---`），用前缀 `---rest` 匹配；reaction 末尾 `---` 残留在 feed 时清理。

**为什么**
- 用户要求 hidden section 预先生成、点开直接呈现：原串行阻塞 final 且点开时可能未完成，并行预取解决。
- 用户问 rehearsal 输出慢：根因是非流式 JSON（等完整 8.4s）+ system 含动态内容 cache miss。流式化让 reaction 逐字出现（4-7s 首字），system 稳定可 cache。

**验证**
- npm run typecheck ✓ / npm run build ✓
- audit:memory-contract ✓（16/16）/ test-daily-contract.mjs ✓（22/22）
- daily e2e 15/15 ✓（hidden 并行未破坏，sections=3 actions=2，timing total=12598ms）
- rehearsal 流式 smoke ✓：content-type=ndjson，reaction 逐字流出，final data 完整，首字 4.6-7.3s（provider 波动），总 9-12s
- 部署：PM2 reload，readiness ready=true/jobHealthy=true

**风险/待优化**
- reaction 首字 4.6-7.3s 波动是 LLM provider TTFT（首轮 cache miss + provider 速度），BFF 层已最优（流式+稳定 system+max_tokens）；如需更快需换更快模型。
- rehearsal marker 格式依赖 LLM 遵守 `---reaction---`/`---rest---`，已做前缀+清理健壮性，但 LLM 极端偏离时 fallback 到 reaction 全文。
- failed=2 是历史旧 job，不影响新链路。
- 未 commit/push（等用户确认后 push）。

## 2026-07-05 05:30 | Cursor | daily 流式无缝衔接

**做了什么**
- 新增 `src/lib/server/daily/prose-section-stream.ts`：合并 prose + visible section 为一次 LLM 调用（marker 流式：prose → `---section:id---` 紧接 section）
- 改 `src/lib/server/daily/daily-turn-bff.ts`：非 safety 分支用 `streamProseAndSections` 替代 `generateDailyProse` + `streamDailySectionCopy` 两次并发调用；hidden section 仍由 `fillDailySectionCopy` 并行预取
- 改 `scripts/test-daily-stream-e2e.mjs`：流式 reader 测 section_start 相对 prose_complete 延迟

**为什么**
- 实测：原 prose 与 section 两次并发 LLM 请求到 provider，section 被 prose 排队，prose_complete 后 section 首字还要等 7630ms
- 合并后一次调用，prose 完成后 section marker 紧接流式，实测 section_start 相对 prose_complete 延迟 = 0ms（无缝）
- 顺序天然保证：LLM 按 visibleSkeletons 顺序输出 marker，前台可见 section 永远先于 hidden（hidden 走并行预取）

**验证**
- typecheck ✓ / build ✓ / 部署 ✓ / readiness ready:true
- e2e：事件首达 start=9ms delta=6070ms prose_complete=6467ms section_start=6467ms（0ms 无缝）section_delta=6467ms
- 15 通过 0 失败

**风险**
- 合并 system prompt 更长（parentFacingStyle+dailyDialogueOrchestration+parentFacingCopy），但稳定前缀可 prompt cache
- 第 3 个 section 偶尔无流式 section_complete 事件（内容在 finalize 时补全，sections_complete/final 仍完整）

## 2026-07-05 11:05 | Cursor | 聊天气泡/深度展开行宽对齐（Batch F3）

**做了什么**
- `app/hifi-app.css`：`.bubble` 改 `overflow-wrap: break-word`（原 anywhere 会在标点处提前断行）；`.section-body p` / `.bubble-reply` 加 `text-align: justify` + `text-justify: inter-ideograph`
- `app/globals.css`：深度展开 `.deep-expand-card` padding 改为 14px 16px（与 `.bubble` 一致）；流式 `.section-body-streaming p` 与 `.deep-expand-body .section-body p` 同步 justify；列表/引语保持左对齐

**为什么**
- 用户确认问题在聊天气泡正文与深度展开，非输入框
- 手机窄屏左对齐导致右侧参差；深度展开卡片 padding 比主气泡窄 4px，行宽不一致

**验证**
- typecheck ✓ / build ✓ / 部署 ✓ / readiness ready:true

**下一步**
- Batch F1/F2/F4/F5（键盘/textarea/语音蒙版与 Safari 卡死）
- Batch A 流式 chunk_smooth

## 2026-07-05 11:35 | Cursor | 任务页状态键与反馈面板

**做了什么**
- `app/tasks/page.tsx`：任务卡改为 div；来源「来自交流」左下角、彩色状态键右下角；仅状态键控制展开/收起（灰色三角 up/down）
- `src/components/tasks/TaskFeedbackPanel.tsx`：移除顶栏返回、底栏提交、已反馈标签；选项点击与备注失焦自动保存并记忆
- `app/hifi-app.css`：`.status-tag--pending/progress/done` 三色 pill；灰色 caret；状态文字不可选中

**为什么**
- 用户要求状态键独占展开控制、视觉与 hi-fi 参考一致、反馈无需提交键且保留记忆

**验证**
- typecheck ✓ / build ✓
- 部署：本机未设 `SSH_HOST`，未执行 deploy

**下一步**
- 设部署变量后 `npm run deploy`；Batch F / Batch A 继续

## 2026-07-06 14:43 | Cursor | 任务页 UI 部署

**做了什么**
- 部署任务页改版：`tasks-ui.css`（状态键/来源底边对齐、三色 pill、灰色三角）、`layout.tsx` 末位引入
- `scope-hifi-app-css.mjs` 同步任务 meta 对齐 overrides

**验证**
- typecheck ✓ / build ✓ / deploy ✓ / readiness ready:true（2026-07-06 14:43 UTC+8）

**下一步**
- 用户强刷 `/tasks` 验证；Batch F / Batch A 继续

## 2026-07-09 20:55 | Codex | 育见 Master BP Word 母稿

**做了什么**
- 扫描项目、产品/技术/BP资料及设计参考，形成完整商业计划书内容底稿。
- 修复 `scripts/extract-hifi-pages.mjs` 的页面数组截取边界，提取真实高保真页面并完成 12 张统一尺寸产品截图。
- 生成 `BP/育见商业计划书.docx`（44 页可编辑 Word 母稿）与 `BP/育见商业计划书.md`，覆盖融资逻辑、产品、技术、验证、商业模式、增长、合规、融资和里程碑。
- 嵌入 14 张真实产品/技术/流程图片；素材来源记录在 `BP/images/图片素材说明.md`。
- 生成脚本位于 `BP/source/build_master_bp.py`，截图脚本位于 `BP/source/capture-screenshots.mjs`。

**事实边界**
- 未虚构收入、付费用户、融资金额、合作签约或团队履历；缺失项已明确列为“待补充/待验证”。
- 市场数据只采用教育部、CNNIC 等公开官方来源。
- 当前实现按四类专项采集入口和四个主功能区表述；FamilyModel 按事实网络、分层记忆和推理机制表述。

**验证**
- Word 完整渲染 44 页，无明显溢出或遮挡。
- DOCX 压缩结构校验通过。
- 14 张图片全部内嵌；可访问性审计 high=0 / medium=0 / low=0。
- Web typecheck、mini typecheck/style audit 均通过；本地 Web 启动但本机 PostgreSQL 未运行，截图改用仓库真实高保真 HTML 页面。

**待补充**
- 团队姓名/履历、法人主体、留存与活跃数据、签约合作证据、收入成本、融资条款、隐私与法律审查。
- 对外使用前需统一“清华公益项目/试点”等背书口径，未经授权不要使用校徽或官方标识。

---

## 2026-07-10 16:45 | Cursor | 小程序像素/动效对齐 Phase 0–4

**做了什么**
- Phase 0：`motion.scss` + `usePageEntering`；HiFiMainShell / HiFiBuildShell `page-entering`；style-parity-audit 增 C-motion
- Phase 1：daily chipFloat、section-reveal、VoiceOverlay（ASR 降级打字 + wave）
- Phase 2：tasks/rehearsal/profile 间距与 checkpoint 每 4 轮动效；去掉 profile 紫色 update-notice
- Phase 3：hifi-build 引入 motion；intro/basic/hub 感知收口
- Phase 4：新建 `pages/profile/evidence` · `verify`；profile/deep/result 导航链；本地 snapshot 含 evidence/verificationPoints
- 文档：visual-diff / DESIGN-TOKENS / parity-verification-log / web-component-map

**为什么**
- 按已确认方案做 Web↔MP 感知对齐（全量动效 + 画像子页补齐）

**验证**
- `miniprogram`: typecheck pass；style-parity-audit P0/P1 fail 0；build:weapp 成功（已知 CSS order warning）

**下一步**
- 真机 390 对照截图；M9-01 ASR E2E（socket 白名单）
- 未 commit / 未 push（等用户指示）

**风险/冲突**
- 仅改 `miniprogram/` 与文档；未改 Web CSS
- 本地有未推送提交与大量未提交变更，收工 push 前请先 `git status` 分拣

---

## 2026-07-10 17:10 | Cursor | 部署 ASR 密钥 + 底栏防漏字

**做了什么**
- 将腾讯云 ASR（TENCENT_APPID/SECRET_*）写入本机 `.env.local` 并 `npm run deploy` 同步到线上
- 验证：`GET /api/asr/token`（Bearer）返回 `wsUrl`（不再 ASR_UNCONFIGURED）
- 小程序底栏/输入区实色 + 高度下调；ASR 瞬时失败可重试

**验证**
- 本地 typecheck/build 通过；deploy exit 0；PM2 yujian/yujian-jobs online
- readiness 仍可能因历史 failed jobs 显示 jobHealthy=false（与 ASR 无关）

**下一步**
- 小程序重新编译预览后试「按住说话」
- 真机需公众平台 socket 合法域名：`wss://asr.cloud.tencent.com`
- 聊天中暴露过密钥/SSH，建议后续轮换

**风险/冲突**
- 勿把 `.env.local`、SSH 密码、SecretKey 写入 Git / HANDOFF 正文

