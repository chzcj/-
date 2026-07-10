# M9 — ASR 语音输入

**模块**：腾讯实时 ASR（交流页 + Onboarding capture）  
**基准**：Web `useTencentAsrInput` + `GET /api/asr/token` → `wss://asr.cloud.tencent.com`  
**日期**：2026-07-08

## 问题与修复

| ID | 问题 | 修复 | 文件 |
|----|------|------|------|
| M9-01a | 未请求 `scope.record`，真机直接失败 | `ensureRecordPermission()`：authorize → openSetting 引导 | `lib/asrPermission.ts` |
| M9-01b | 腾讯 ASR `code` 非 0 未处理 | 解析 `code`，忽略心跳 `111`，其余展示错误并 cleanup | `hooks/useTencentAsrInput.ts` |
| M9-01c | `ASR_UNCONFIGURED` / socket 失败无明确提示 | `mapAsrError` + socket 域名说明；`serviceUnavailable` 标记 | 同上 |
| M9-01d | 松手滑出未结束录音 | `onTouchCancel={stopVoice}` | `HiFiInputZone`, `BuildRecordBox` |
| M9-01e | 服务不可用时仍显示「按住说话」 | `asrUnavailable` → 禁用按住、自动切文字模式 /「请直接输入」 | `HiFiInputZone`, `BuildRecordBox` |

## 数据流（对齐 Web）

```
按住说话 → ensureRecordPermission
         → GET /api/asr/token { wsUrl }
         → Taro.connectSocket(wsUrl)
         → onOpen → RecorderManager PCM 16k 推流
         → onMessage slice_type 0/1 临时 / 2 定稿
         → 松手 stopListening → onSubmit(text, 'voice')
```

## 运维清单（代码外，M9-01 仍 open 直至真机 verified）

1. 服务端环境变量：`TENCENT_APPID`、`TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`（或项目等价命名）
2. 微信公众平台 → 开发 → 开发管理 → 服务器域名 → **socket 合法域名**：`wss://asr.cloud.tencent.com`
3. 真机调试可临时勾选「不校验合法域名」
4. 用户需允许麦克风（`scope.record`）

## 回归 smoke

| 场景 | 预期 |
|------|------|
| 开发工具 + 未配域名 | 红色提示 socket 域名；交流页自动文字模式 |
| 未配 TENCENT_* | `ASR_UNCONFIGURED` 文案；按住禁用 |
| 拒绝麦克风 | 引导设置页文案 |
| 配置正确真机 | 按住 → 实时字幕 → 松手发送 |
| capture 模块 | BuildRecordBox 同上；Textarea 始终可打字 |

## 构建

```bash
npm run typecheck && npm run build:weapp
```

## 状态

- **客户端逻辑**：fixed（本模块范围内）
- **M9-01 真机 E2E**：open — 依赖运维 + 真机验收（清单：[M9-DEVICE-QA.md](../M9-DEVICE-QA.md)）
