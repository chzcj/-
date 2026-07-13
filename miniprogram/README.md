# 育见微信小程序支线

独立于网页版 Next.js 的 Taro 3 + React 小程序，复用 `https://yujian.yihe.site` 同一套 BFF API。UI 对齐 Web **hi-fi 绿色系**（`hifi-app.css`），非旧版紫色设计稿。

## 微信开发者工具（务必按此操作，避免「页面不存在」）

1. **先构建**：`cd miniprogram && npm run build:weapp`（改代码后 dev 模式用 `npm run dev:weapp`）
2. **导入目录**：选择 **`/path/to/育见-2/miniprogram`**（含 `project.config.json` 的文件夹）
   - ❌ 不要导入仓库根目录 `育见-2/`
   - ❌ 不要只导入 `miniprogram/src/` 或 `miniprogram/dist/`
3. **AppID**：`wx85cc99d660b0c0ac`
4. `project.config.json` 已设置 `miniprogramRoot: dist/`，工具会读编译产物
5. **Tab 页跳转**必须用 `Taro.switchTab`（已在 `utils/navigation.ts` 实现）
6. Onboarding 分包路径：`packageOnboarding/pages/...`（位于 `src/packageOnboarding/`）

开发阶段可勾选：**不校验合法域名、web-view、TLS 版本**（语音识别 WebSocket 在开发期也依赖此项）。

## 语音识别（ASR）

**实时按住说话（交流 / 预演 / 四模块）**：讯飞实时转写大模型，方案 A 直连。  
BFF 仅签发已签名 `wsUrl`（`GET /api/asr/iflytek/url`），**不要把 APIKey/APISecret 写进小程序**。

**亲子对话整段录音**：仍走腾讯云录音文件识别（`POST /api/rehearsal/dialogue-transcribe`），与实时链路无关。

`.env.local` 需配置：`IFLYTEK_APP_ID`、`IFLYTEK_API_KEY`、`IFLYTEK_API_SECRET`（实时）；`TENCENT_*`（亲子文件转写）。

链路：

```
实时：小程序 → GET /api/asr/iflytek/url → wss://office-api-ast-dx.iflyaisol.com/...
亲子：RecorderManager(mp3) → uploadFile → /api/rehearsal/dialogue-transcribe → 腾讯文件 ASR
```

### Socket 合法域名（实时语音必配）

| 环境 | 配置 |
|------|------|
| 开发者工具（开发） | 详情 → 本地设置 → **不校验合法域名、web-view、TLS 版本** |
| 真机预览 / 上线 | 微信公众平台 → **socket 合法域名** 添加 `wss://office-api-ast-dx.iflyaisol.com` |

未配置时控制台会出现讯飞域名「不在 socket 合法域名列表中」。

### 服务端环境变量（网页 API 部署侧）

在服务器 `.env.local` 配置（与小程序 AppSecret 不同）：

```
IFLYTEK_APP_ID=…
IFLYTEK_API_KEY=…
IFLYTEK_API_SECRET=…
TENCENT_APPID=…          # 亲子文件转写
TENCENT_SECRET_ID=…
TENCENT_SECRET_KEY=…
```

未配置讯飞时 `/api/asr/iflytek/url` 返回 `ASR_UNCONFIGURED`；未配置腾讯时亲子文件转写不可用。

**真机验收**：见 [docs/M9-DEVICE-QA.md](./docs/M9-DEVICE-QA.md)。


```bash
cd miniprogram
npm install
npm run dev:weapp
```

## 生产配置

1. 微信公众平台 → 开发 → 开发管理 → 开发设置 → **服务器域名**
   - request 合法域名：`https://yujian.yihe.site`
2. 服务端 `.env.local` 配置：
   ```
   WECHAT_APPID=wx85cc99d660b0c0ac
   WECHAT_SECRET=<小程序 AppSecret，不是 EncodingAESKey>
   ```
3. 部署网页 API：`npm run deploy`（小程序代码不会上传服务器）

## 功能对照

| 网页 Tab | 小程序页面 | API |
|----------|-----------|-----|
| 交流 | pages/daily | POST /api/daily/stream (NDJSON chunked) |
| 任务 | pages/tasks | GET/POST /api/tasks |
| 预演 | pages/rehearsal | POST /api/rehearsal/analyze |
| 画像 | pages/profile | GET /api/profile/hub, card |
| Onboarding | packageOnboarding | entry/analyze, synthesis, diagnosis |

## 鉴权

- 小程序：`wx.login` → `POST /api/auth/wechat` → `sessionToken` 存本地
- 请求头：`Authorization: Bearer <sessionToken>`
- 网页版仍用 Cookie，互不影响

## UI 架构

- 设计 token：`src/styles/tokens.scss`（来自 Web `hifi-app.css`）
- 壳层：`src/components/hifi/HiFiMainShell`
- 底部导航：`tabBar.custom: true` + `src/custom-tab-bar/`（对齐 `HiFiBottomNav`）
- Daily 组件：`src/components/daily/`

## 上传发布

```bash
cd miniprogram && npm run build:weapp
# 微信开发者工具 → 导入 miniprogram/ → 上传
```

提审材料见 [docs/miniprogram-release.md](../docs/miniprogram-release.md)。
