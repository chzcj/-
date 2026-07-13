# 育见小程序：麦克风授权弹窗不出现 — Claude Code 迁移说明

**给**：Claude Code（下一位接手 Agent）  
**日期**：2026-07-12 17:35  
**仓库**：Gitee `https://gitee.com/heartlab/yujian` · 分支 `master`  
**工作区**：`/Users/mac/Desktop/育见-2`  
**前置手册**：[2026-07-12-voice-scroll-rehearsal-claude-code.md](./2026-07-12-voice-scroll-rehearsal-claude-code.md)（语音状态机 / 回底 / 预演；本文只升级「权限弹窗」主线）

---

## 0. 一句话任务

**真机按住说话时，系统麦克风授权弹窗 / 隐私同意弹窗仍完全不出现，语音始终无字。**  
修好「能弹出授权 → 用户允许 → 再次按住能出字」。其它项（交流回底、预演取消跟滚、亲子录音按钮、乱码）用户已确认 OK，**不要重开**。

---

## 1. 用户现状（2026-07-12 最新）

| 项 | 状态 |
|----|------|
| 交流自动回底 | ✅ 已好 |
| 预演取消自动跟滚 | ✅ 已好 |
| 亲子对话「开始录音」可点 | ✅ 已好 |
| 流式乱码 | ✅ 已好（或暂无新反馈） |
| **按住说话出字** | ❌ 仍不行 |
| **授权弹窗** | ❌ **完全没有**（隐私窗 / 系统麦克风窗 / 甚至我们的 showModal 引导用户都说没看到） |

用户原话要点：觉得「根本没申请麦克风权限」。交付/域名/预览链 **禁止再甩锅**（见前置手册 §1）。

---

## 2. 当前代码意图（Cursor 已改到哪）

### 2.1 关键文件

| 文件 | 职责 |
|------|------|
| `miniprogram/src/lib/asrPermission.ts` | `getRecordAuthStatus` / `ensureRecordPermission({ interactive })` → `authorize(scope.record)` |
| `miniprogram/src/lib/wechatPrivacy.ts` | `__usePrivacyCheck__` 下隐私：`getPrivacySetting` / `requirePrivacyAuthorize` / Gate |
| `miniprogram/src/components/privacy/PrivacyAgreementGate.tsx` | 自定义隐私同意（`open-type="agreePrivacyAuthorization"`） |
| `miniprogram/src/components/hifi/HiFiInputZone/index.tsx` | 按住说话 UI；**未授权时先 interactive 申请，再提示「再次按住」** |
| `miniprogram/src/components/profile/BuildRecordBox.tsx` | Onboarding 同逻辑 |
| `miniprogram/src/hooks/useTencentAsrInput.ts` | 早开麦 + 节流 flush；`ensureRecordPermission({ interactive: false })` |
| `miniprogram/src/app.config.ts` | `__usePrivacyCheck__: true`；**故意不写** `permission["scope.record"]`（微信会报无效） |
| `miniprogram/src/app.tsx` | 挂载 `PrivacyAgreementGate` |

### 2.2 当前交互设计（意图）

```text
touchStart「按住说话」
  → getRecordAuthStatus()
  → 若 !== granted：
       松手视觉复位
       ensureRecordPermission({ interactive: true })
         → ensurePrivacyAuthorized()
         → showModal「允许使用麦克风」
         → Taro.authorize({ scope: 'scope.record' })
       成功则 hint「请再次按住说话」
  → 若已 granted：startListening()（开麦 + token + socket）
```

### 2.3 Cursor 已修过的坑（不要再犯）

1. **不要**对 `authorize` 做 8s `Promise.race` —— 会制造 `(in promise) SystemError timeout`，并在用户还没点「允许」时误判失败。  
2. **不要**「握手成功后再 `startRecorder`」——用户 1–3s 松手会导致录音从未开始、transcript 空。已改回：权限过 → 立刻开麦，socket 并行，onOpen 后 50ms 节流 flush。  
3. **不要**把 `scope.record` 写进 `app.json permission` —— 无效配置。  
4. **不要**把 `getRecorderManager` 写进 `requiredPrivateInfos` —— 该字段只给地理位置 API。  
5. 文档 `M9-DEVICE-QA.md` / `RELEASE-CHECKLIST.md` 里「已声明 permission.scope.record」**已过时**，以 `app.config.ts` 为准。

---

## 3. 强烈怀疑的根因（请按序验证）

### P0 — `await` 丢了用户手势（最可疑）

微信：`wx.authorize` / 部分弹窗依赖**同步用户手势**。  
当前 `HiFiInputZone.startVoice` 在 `touchStart` 里：

```ts
void (async () => {
  const status = await getRecordAuthStatus()   // ← await 后手势栈断了
  if (!holdingRef.current) return              // ← 松手会直接 return，连 interactive 都不走
  if (status !== 'granted') {
    await ensureRecordPermission({ interactive: true })  // showModal + authorize 可能静默失败
  }
})()
```

**现象匹配**：用户按住→松手，**任何授权 UI 都不出现**；若松手发生在 `getSetting` 返回前，第二条 `if (!holdingRef.current) return` 会直接吞掉申请。

**建议改法（择一或组合）**：

1. **独立「开启麦克风」按钮**（`Button` `onClick`）：手势干净，点一次只做隐私+authorize；成功后再允许按住说话。  
2. 或在 `touchStart` **同步**调用 `wx.authorize`（authorize 前后尽量不要 await getSetting；可先 authorize，再用 getSetting 校验）。  
3. 去掉「`!holdingRef.current` 就 return」对**权限申请**的短路：权限申请应在松手后仍继续，不能依赖按住态。

### P0 — 隐私协议阻断且 Gate 未露出

`app.config.ts` 有 `__usePrivacyCheck__: true`。  
若公众平台已声明「麦克风」等隐私类型，且用户未同意：

- `getPrivacySetting.needAuthorization === true`
- 必须 `requirePrivacyAuthorize` + `onNeedPrivacyAuthorization` → `PrivacyAgreementGate`

排查：

1. 真机调试器里执行：`wx.getPrivacySetting({ success: console.log })`  
2. `PrivacyAgreementGate` 是否真挂在页面上（`app.tsx` 有；确认 dist 里有）  
3. `onNeedPrivacyAuthorization` 是否注册成功（必须在调用隐私接口**之前**；应用启动时 `initPrivacyAuthorization`）  
4. 公众平台「用户隐私保护指引」是否已发布且含**麦克风/录音**用途（见 `miniprogram/docs/REVIEW-SUBMISSION.md`）

若后台**未声明**麦克风：`needAuthorization` 可能一直 false，但 `RecorderManager.start` / ASR 仍可能因合规失败——需对照后台配置。

### P1 — `getSetting` 误报已授权

若 `authSetting['scope.record'] === true`（或开发者工具缓存），代码会**跳过**所有弹窗直接 `startListening`。  
请在真机 Console 打：

```js
wx.getSetting({ success: (r) => console.log('record=', r.authSetting['scope.record']) })
```

- `undefined`：从未问过 → 必须能弹 authorize  
- `false`：已拒绝 → 只能 `openSetting`  
- `true`：已授权 → 问题在录音/ASR 而非弹窗（换主线）

### P1 — Taro 桥 vs 原生 `wx`

隐私 API 已尝试 `globalThis.wx` 优先。authorize 仍走 `Taro.authorize`。  
建议对比：`wx.authorize({ scope: 'scope.record', success, fail })` 直接调用，并把 `fail.errMsg` 打到 UI（现在 catch 后信息过粗）。

### P2 — 录音本身

若授权其实已是 true 仍无字：回到 `useTencentAsrInput`（帧是否发出、token、socket、`end`）。  
但用户明确说**没有授权弹窗**，请先把弹窗路径打通并拿到 `fail` 原文，再回头查 ASR。

---

## 4. 建议实施步骤（给 Claude）

### Step A — 证据（先别大改）

在 `ensureRecordPermission` / `startVoice` 临时加可见日志（或 `Taro.showToast` 阶段文案），确认走到哪一步：

1. `getRecordAuthStatus` 返回值  
2. 是否进入 `interactive`  
3. `ensurePrivacyAuthorized` ok/fail + message  
4. `showModal` confirm 与否  
5. `authorize` success / **fail.errMsg 全文**

真机按住一次，把这 5 步结果记进回复。

### Step B — 手势安全的授权入口（推荐落地）

在 `HiFiInputZone` 语音模式增加明确 CTA，例如：

- 未授权：主按钮旁或取代按住区 → 「点击开启麦克风」`Button`  
- `onClick` → `ensurePrivacyAuthorized` → `wx.authorize({ scope: 'scope.record' })` → 校验 `getSetting`  
- 已授权：恢复「按住说话」

按住路径内：**禁止**再在 `await` 之后依赖手势弹 authorize；最多做 `getSetting` 快检，未授权则 toast「请先点击开启麦克风」。

### Step C — 修 startVoice 短路

```ts
// 坏：松手后彻底不申请
if (!holdingRef.current) return

// 好：未授权时无论是否仍按住，都走完 interactive；仅 startListening 需要仍按住
```

### Step D — 验收

1. 清除小程序数据 / 或换未授权微信号  
2. 点击「开启麦克风」→ 必现隐私（若 needAuthorization）→ 必现系统录音授权  
3. 允许后按住 ≥2s → 有字或明确 ASR 错误（非空静默）  
4. 拒绝后有去设置引导；文字输入仍可用  

```bash
cd miniprogram && npm run typecheck && npm run build:weapp
```

BFF 无改可不 `deploy`。

---

## 5. 公众平台检查清单（非代码，但常堵死）

| 检查 | 说明 |
|------|------|
| 用户隐私保护指引已发布 | 含「麦克风 / 录音」收集用途 |
| 开发版/体验版用的是该 AppID | `wx85cc99d660b0c0ac` |
| 真机不是模拟器 | ASR/权限以真机为准 |
| 微信版本与基础库 | 隐私 API 需较新基础库；用户侧曾见 3.x |

代码无法代替后台隐私声明；若声明缺失，表现可能是「接口 fail、无弹窗或秒 fail」。

---

## 6. 不要做的事

- 不要再改波浪 CSS / 「连接中」文案当主修复  
- 不要再甩锅：合法域名、没预览、没勾不校验域名  
- 不要恢复「仅 socket 开了才 startRecorder」  
- 不要给 `authorize` 加短超时 race  
- 不要大范围重构 daily/rehearsal 已修好的滚动  
- 不要把密钥写入 Git / HANDOFF  

---

## 7. 收工格式（用户要求）

回复用户时用：

1. **已改问题**  
2. **文件**  
3. **为什么**  
4. **三轮自检**  
5. **残留风险**  

并更新 `.agents/HANDOFF.md`；commit 仅在用户要求时（前缀 `[cursor]` / `[codex]`）。

---

## 8. 相关旧文档

- 语音状态机全景：`docs/handoff/2026-07-12-voice-scroll-rehearsal-claude-code.md`  
- 提审/隐私文案：`miniprogram/docs/REVIEW-SUBMISSION.md`  
- 设备 QA（部分过时）：`miniprogram/docs/M9-DEVICE-QA.md`  
- ASR 模块笔记：`miniprogram/docs/module-reports/M9-asr.md`  

---

**结论交给 Claude**：当前最大概率不是「没写 authorize」，而是 **(1) await 后丢失用户手势导致 authorize/弹窗静默失败**，以及 **(2) 松手把 `holdingRef` 置 false 后提前 return，连 interactive 申请都没跑到**。请先用阶段日志证实，再用「独立 Button 开启麦克风」打通弹窗，再谈出字。
