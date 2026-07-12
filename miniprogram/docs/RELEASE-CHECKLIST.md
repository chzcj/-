# 育见小程序 · 正式发布清单

**版本**：2026-07-11  
**AppId**：`wx85cc99d660b0c0ac`（见 `project.config.json`）

## 1. 代码与构建

- [ ] `cd miniprogram && npm run typecheck`
- [ ] `npm run build:weapp` 无 error
- [ ] `node scripts/audit-share.mjs` 全页分享通过
- [ ] `node scripts/health-check.mjs`（BFF readiness + asr/token 形态）

## 2. 微信公众平台

- [ ] **request 合法域名**：`https://yujian.yihe.site`
- [ ] **socket 合法域名**：`wss://asr.cloud.tencent.com`
- [ ] **uploadFile 合法域名**（对话录音）：`https://yujian.yihe.site`
- [ ] 隐私协议 / 用户隐私保护指引（含麦克风说明）— 文案见 [REVIEW-SUBMISSION.md](./REVIEW-SUBMISSION.md) §2
- [ ] 小程序已开启 `__usePrivacyCheck__` + `permission.scope.record`（**勿**在 `requiredPrivateInfos` 填录音 API，该字段仅用于地理位置）
- [ ] 服务类目与「家庭教育/工具」实际功能一致

## 3. 真机 E2E（发布前必做）

| # | 场景 | 通过 |
|---|------|------|
| 1 | 微信登录 → onboarding 或四 Tab | |
| 2 | 交流：文字发送 + 自动滚底 + 流式完整 | |
| 3 | 交流：真机按住说话 3–5 秒 ×5 | |
| 4 | 预演：场景 → 对话 → 任务保存 | |
| 5 | 任务：展开/收起 + 反馈提交 | |
| 6 | 画像 Tab 加载 + 卡片详情 | |
| 7 | 好友转发 + 朋友圈（无「未设置分享」） | |

详见 [M9-DEVICE-QA.md](./M9-DEVICE-QA.md)

## 4. 上传与提审

1. 微信开发者工具 → 上传（填写版本号与备注）
2. mp.weixin.qq.com → 版本管理 → 提交审核
3. 审核说明：见 [REVIEW-SUBMISSION.md](./REVIEW-SUBMISSION.md) §1（产品为家长端 AI 家庭教育记录与沟通辅助，需麦克风用于按住说话）

## 5. 已知非阻断

- 线上 `readiness ready:false` 可能因历史 failed jobs（`jobHealthy=false`）
- 模拟器 ASR 不验收，已 UI 降级

## 6. 架构参考

- [REVIEW-SUBMISSION.md](./REVIEW-SUBMISSION.md) — 提审说明与隐私文案
- [streaming-asr-architecture.md](./streaming-asr-architecture.md)
- [stability-audit-2026-07-11.md](./stability-audit-2026-07-11.md)
- Cursor 规则：`.cursor/rules/miniprogram-stability-ux.mdc`
