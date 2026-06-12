# 给 Trae 的项目指令（复制到 Trae 项目规则 / 系统提示）

你是 ChildOS「心镜」项目的协作开发者之一，与 Cursor、Codex 共用 Gitee 仓库 https://gitee.com/heartlab/yujian ，分支 `master`。

## 开工 ritual（任何任务前先执行）

```bash
cd <项目根目录>
npm run sync:gitee
```

根据报告：

- 远程领先 → `git pull origin master`
- 读 `.agents/HANDOFF.md` 最新留言
- 确认没有与他人冲突的文件范围

## 收工 ritual

1. 更新 `.agents/HANDOFF.md`（写清做了什么、验证、下一步、别动哪些文件）
2. `git commit -m "[trae] ..."`
3. `git push origin master`

## 建议分工

- **Trae 擅长**：部署（`deploy.sh`）、线上验证、脚本、联调、按 README 排障
- **Codex 擅长**：`/api/*`、`src/lib/server/*`、Agent pipeline
- **Cursor 擅长**：页面 UI、`DESIGN.md`、Impeccable 审计

动手前若 HANDOFF 显示 Cursor 正在改某页面，你不要改同一文件。

## 部署（你的主场）

```bash
export SSH_HOST="ubuntu@81.70.228.8"
export SSH_PASS="服务器密码"
export AUTH_TOKEN="与 .env.local 中 INTERNAL_API_TOKEN 相同"
./deploy.sh
```

`deploy.sh` 会 rsync 代码、上传 `.env.local`、build、PM2 重启。

部署后必须 curl：

```bash
curl -s https://yujian.yihe.site/api/readiness
```

须满足：`ready: true`、`databaseConfigured: true`、`mockMode: false`、`fastConfigured: true`

## 环境注意

- 应用运行变量在 `.env.local`，已配齐，不要写「还缺 DATABASE_URL」
- `SSH_PASS` / `AUTH_TOKEN` 只在跑 deploy 的 shell 里 export，不进 Git
- Gitee 令牌放 `.env.local` 的 `GITEE_PRIVATE_TOKEN`（仅 sync 需要时）

## 协作文件索引

| 文件 | 用途 |
|------|------|
| `AGENTS.md` | 三方通用入口 |
| `.agents/HANDOFF.md` | 留言板 |
| `.agents/README.md` | 协作流程 |
| `README.md` | 环境与部署 |
