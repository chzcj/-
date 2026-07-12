# Visual Parity 验收记录

每次 S 级或 build 页完成自检后追加一行。完整模板见 [PORTING-SELF-CHECK.md](./PORTING-SELF-CHECK.md) Step 7。

## 全站收口表（滚动更新）

| 路径 | Web | 小程序 | P0 | P1 | visual-diff |
|------|-----|--------|----|----|-------------|
| 交流 | /daily | pages/daily | pass | audit | 字体 P1；深度展开待验 |
| 任务 | /tasks | pages/tasks | pass | pass | — |
| 预演 | /rehearsal | pages/rehearsal | pass | pass | checkpoint P2 |
| 画像 | /family-profile | pages/profile | pass | audit | 卡片详情 shell P1 |
| 引导 intro | /profile/build/intro | packageOnboarding/intro | pass | audit | — |
| build capture | /profile/build/homework | capture?entryType=homework | pass | audit | 字重 P1 |
| build follow-up | …/follow-up | follow-up | pass | audit | — |
| build summary | …/summary | summary | pass | audit | — |

## 2026-07-08 — Onboarding build 三页（代码级自检）

**范围**：capture、follow-up、summary

### Web Token 摘要（节选）

| Token | Web | 小程序 |
|-------|-----|--------|
| page padding | 12px 20px | hifi-build .page 同 |
| bottom-actions | 玻璃卡 grid fixed | hifi-build.scss |
| record-area min-h | 184px | BuildRecordBox |
| primary btn | 48px pill 绿渐变 | primary-button |

### 对照验收

| 验收点 | 结果 |
|--------|------|
| 第一眼品牌感 | 黄绿 hero + 奶油底，与 Web build 一致 |
| 页面结构 | 进度条 → hero → 内容 → 底 CTA |
| 操作路径 | capture 提交 → follow-up 可跳过 → summary 可下一模块 |
| 信息重点 | record-box / FollowUpCard 为第二视觉 |
| 使用感受 | 语音在输入区内，底栏不挤 |

### 结论

- [x] build 三页可进入 intro/hub 等下一轮 porting（P0 结构已过）
- [ ] 真机 ASR 需 socket 白名单（见 README）

### 文档

- [x] web-component-map.md → parity-audit
- [x] visual-diff.md P0/P1/P2
- [x] tokens.scss + DESIGN-TOKENS.md

## 2026-07-08 — S1 壳层 + S2 输入区（Token 对齐）

**范围**：HiFiMainShell、hifi-base page 占位、HiFiInputZone、custom-tab-bar

| 验收点 | 结果 |
|--------|------|
| page--with-input 底留白 | tab-bar-height + input-dock-height token |
| hold-button 高度 | $btn-height-primary 52px |
| Tab 固定底 | custom-tab-bar 68px + safe |

**结论**：parity-audit（待开发者工具 390 对照 /daily）

## 用户旅程测试（口述）

登录 → intro → basic → hub → capture 任一模块 → follow-up（可跳过）→ summary → generating → 四 Tab → daily 发一条 → 深度展开（若 action 出现）

**可冻结**：tokens、PORTING 文档、build 三页结构、Round3 静态 class/token  
**第二轮**：intro/basic/hub 像素、Daily 深度展开 verified、SVG Tab 图标、真机 ASR E2E

## 2026-07-08 — Round3 静态审计 + M9 ASR

**范围**：`style-parity-audit.mjs`、M4–M7 Tab 页 token/class、ASR 权限与降级

| 验收点 | 结果 |
|--------|------|
| style-parity-audit | 7/7 class + 4/4 token pass |
| ASR 权限 | `asrPermission.ts` + 错误文案 |
| ASR 降级 | `asrUnavailable` 禁用按住 / 切文字 |
| touch cancel | HiFiInputZone + BuildRecordBox |

**结论**：静态视觉 parity 无 P0/P1 失败；M9-01 真机 E2E 仍依赖 socket 白名单与服务端密钥。

**文档**：`module-reports/M9-asr.md`、`style-parity-report.md`

## 2026-07-09 — M10 剩余 Backlog 全量收口

**范围**：M2-07~11、M4-05、M5-05/06、M6-05、M7-05、M8-01

| 验收点 | 结果 |
|--------|------|
| onboarding 错误态 | capture/follow-up 内联卡 + hub 重填确认 |
| summary 权威卡 | AuthorityInsightCard + StructuralTensionCard |
| daily 深度展开 | DailySectionView authority 段 + 流式解析 |
| how-to-speak | 独立页 + DailyAiMessage action |
| profile deep | 机制链页 + Tab 入口 |
| 账号 | 改密 / 注销 modal |
| 预演 | RehearsalDialogueCapture |
| account/state | childos.v1 assemble + hydrate |

**结论**：代码侧 backlog 除 M9-01 运维项外已全部 fixed。详见 `module-reports/M10-remaining-backlog.md`。

## 2026-07-10 — 像素级与动效对齐（Phase 0–4）

**范围**：motion 基础设施 → daily → 四 Tab → onboarding → evidence/verify

### 三轮自检

| 轮次 | 内容 | 结果 |
|------|------|------|
| 1 typecheck | `npm run typecheck` | pass |
| 2 build | `npm run build:weapp` + `style-parity-audit` | pass（P0/P1 fail 0；CSS order warning 已知） |
| 3 产品 smoke | 登录→建模→四 Tab→daily 流式/深度反馈→画像 evidence/verify | 代码路径已通；真机 ASR 仍见 M9-01 |

### 对照验收

| 路径 | P0 | P1 | 动效 | 备注 |
|------|----|----|------|------|
| daily | pass | verified | page-entering / chipFloat / section-reveal / VoiceOverlay | ASR 降级打字 |
| tasks | pass | verified | task-card 进场 | — |
| rehearsal | pass | verified | checkpoint 每 4 轮 | — |
| profile | pass | verified | data-card 进场 | 相关操作含 evidence/verify |
| intro/basic/hub | pass | verified | BuildShell page-entering | — |
| build 三页 | pass | verified | motion via hifi-build | — |
| evidence/verify | pass | verified | MainShell 进场 | 新建页 |

### 文档

- [x] visual-diff.md 更新（进场/checkpoint/VoiceOverlay 已对齐）
- [x] DESIGN-TOKENS.md 增补 motion 节
- [x] web-component-map 增补 VoiceOverlay / evidence / verify

## 2026-07-11 — 小程序主端全栈审查包（Phase 0）

**范围**：MP↔Web BFF 契约、四 Tab + onboarding + 弹窗 @390px

### 差距矩阵（已修 / 待验）

| ID | 项 | 状态 |
|----|-----|------|
| B1 | summary → memory/write | 已接 summary/index.tsx |
| B2 | profileSync evidence 非空 | 已接 profileSync.ts |
| B3 | account/profile | 改 parentStorage + pushAccountSync（无 PUT 路由） |
| B4 | wechat profile_rewrite | 已接 auth/wechat |
| appendMode | entry/analyze 增量补充 | BFF + capture/follow-up |
| A1 | 分享 showShareMenu | 全页 useSharePage |
| A5 | ASR 16k_zh_large + end 信号 | token + useTencentAsrInput |
| 补充画像 | hub→capture supplement→generating regen | FE 闭环 + regen 门禁 |

### Impeccable 390px 审计点

- pill min-height 44px、primary/disabled/block
- DailyAiMessage sectionsComplete 门控 end-actions
- ProfileEditModals / basic 年级 Picker
- tasks 空态 CTA、rehearsal chat-feed 底 padding
