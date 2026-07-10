# M9 真机 ASR 验收清单

**状态**：M9-01（运维 + 真机 E2E）  
**客户端**：`useTencentAsrInput` + `asrPermission` 已 fixed，见 [M9-asr.md](./module-reports/M9-asr.md)

## 前置配置（一次性）

### 1. 微信公众平台

| 项 | 值 |
|----|-----|
| socket 合法域名 | `wss://asr.cloud.tencent.com` |
| request 合法域名 | `https://yujian.yihe.site` |

开发期可在开发者工具勾选：**不校验合法域名、web-view、TLS 版本**。

### 2. 服务端 `.env`

```
TENCENT_APPID=<语音识别 AppId>
TENCENT_SECRET_ID=<CAM SecretId>
TENCENT_SECRET_KEY=<CAM SecretKey>
```

验证：`GET https://yujian.yihe.site/api/asr/token`（带登录 Bearer）应返回 `{ ok: true, data: { wsUrl: "wss://..." } }`，而非 `ASR_UNCONFIGURED`。

### 3. 小程序权限

`app.config.ts` 已声明 `scope.record`。真机首次按住说话应弹出麦克风授权。

---

## 验收用例

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| 1 | 交流页语音 | 登录 → 四 Tab → 交流 → 按住说话 3 秒 → 松手 | 实时字幕 → 发送一条语音消息 |
| 2 | capture 语音 | onboarding capture → 按住说话 | 文本写入 Textarea |
| 3 | 拒绝权限 | 拒绝麦克风 → 再按 | 提示去设置；文字输入仍可用 |
| 4 | 未配域名 | 真机预览（未配 socket 域名） | 红色 socket 提示；自动切文字模式 |
| 5 | 未配密钥 | 删除 TENCENT_* 后 token | 「语音服务未配置」；按住禁用 |
| 6 | 预演对话解读 | 预演页底部 → 按住录音 | 同 ASR 链路 |

---

## 失败排查

| 现象 | 可能原因 |
|------|----------|
| `wss://asr.cloud.tencent.com 不在合法域名列表` | 公众平台未配 socket 域名 |
| `ASR_UNCONFIGURED` | 服务端缺 TENCENT_* |
| 按住无反应 | `scope.record` 未授权 |
| 连接后立即断开 | 密钥/AppId 错误或腾讯侧欠费 |
| 开发工具正常、真机失败 | 几乎总是 socket 白名单 |

---

## 签收

- [ ] socket 域名已配
- [ ] TENCENT_* 已配且 token 接口 200
- [ ] 真机用例 1、2 通过
- [ ] 用例 3–5 降级文案符合预期

全部勾选后，可将 `issue-backlog.md` 中 **M9-01** 标为 `verified`。
