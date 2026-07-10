# 育见微信小程序上线清单

## 1. 微信公众平台配置

- **AppID**：`wx2314508a129bc841`（见根目录 `project.config.json`）
- **服务器域名**（必须 HTTPS + 备案）：
  - request：`https://yujian.yihe.site`
- **业务域名**（若内嵌 H5 再配）：一般不需要

## 2. 服务端环境变量

在生产 `apps/yujian/.env.local` 增加：

```env
WECHAT_APPID=wx2314508a129bc841
WECHAT_SECRET=<从微信公众平台获取，勿提交 Git>
```

部署后验证：

```bash
curl -X POST https://yujian.yihe.site/api/auth/wechat \
  -H 'Content-Type: application/json' \
  -d '{"code":"test"}'
# 应返回 WECHAT_CODE_INVALID（说明路由已通），而非 404
```

## 3. 数据库迁移

首次部署含微信登录的 API 版本后，`ensureDbSchema` 会自动添加：

- `users.wechat_openid`
- `users.wechat_unionid`

也可手动执行 `scripts/migrate-wechat-auth.sql`。

## 4. 体验版内测

1. `cd miniprogram && npm run build:weapp`
2. 微信开发者工具 → 上传 → 选体验版
3. 成员管理 → 添加体验者微信号
4. 验证路径：登录 → Onboarding → 交流流式 → 画像/预演/任务

## 5. 提审材料建议

| 材料 | 说明 |
|------|------|
| 用户协议 | 说明 AI 生成内容仅供参考，不替代医疗/心理咨询 |
| 隐私政策 | 收集 openid、对话内容用于个性化分析；存储期限与删除方式 |
| 类目 | 教育 > 在线教育 或 生活服务；按实际资质选择 |
| 测试账号 | 提供已完成 Onboarding 的体验账号说明（或录屏） |
| AI 标识 | 界面标注「AI 生成内容」；敏感场景安全文案已内置 |

## 6. 与网页版隔离

- `deploy.sh` 已排除 `miniprogram/`，网页 PM2 部署不受影响
- 小程序单独发版，不走 rsync

## 8. 数据架构（服务器为主）

| 数据 | API / 表 | 说明 |
|------|----------|------|
| 微信用户 | `POST /api/auth/wechat` → `users` | openid 唯一标识，与网页账号可二期合并 |
| 会话 | `auth_sessions` | Bearer token，30 天有效 |
| 孩子昵称/年级 | `POST /api/account/state` | 客户端备份，换机恢复 |
| 四模块采集进度 | `POST /api/profile/build-state` | 跨设备续做 Onboarding |
| 画像快照 | `POST /api/profile/built` | 设置 `onboarding_complete=true` |
| 交流记录 | `turn_events` + `GET /api/daily/thread` | 服务器主数据源 |
| 任务 | `/api/tasks` | 纯服务端 |

本地仅缓存 `sessionToken` 与离线可读副本，不作为权威数据源。

## 7. 已知限制（一期）

- 语音输入：网页 WebSocket ASR 未移植；预演/交流以文字为主
- 深度展开、section-retry 等待 P3 迭代
- 微信账号与手机号账号合并：二期 `POST /api/auth/bind-phone`
