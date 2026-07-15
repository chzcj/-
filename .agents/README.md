# 多 Agent 协作（Cursor / Trae / Codex）

远程仓库：**Gitee** https://gitee.com/heartlab/yujian ，默认分支 **`master`**。

## 开工 ritual（三个工具统一）

```bash
npm run sync:gitee
# 或
node .agents/scripts/sync-gitee.mjs
```

脚本会：

1. `git fetch origin master`（可用 `.env.local` 里的 `GITEE_PRIVATE_TOKEN`）
2. 显示本地 vs 远程 领先/落后
3. 列出远程最近提交、尚未拉取的提交
4. 打印 `.agents/HANDOFF.md` 最新一条

## 重要复盘（语音）

- [2026-07-14 语音失效复盘](./postmortems/2026-07-14-voice-asr-outage.md)（实时 ASR + 亲子录音：根因、试错、用户纠正应对、传承清单）
- 配套规则：`.cursor/rules/voice-debug-code-first.mdc`、`.cursor/rules/voice-input-locked.mdc`

若远程有新提交：

```bash
git pull origin master
```

## 收工 ritual

1. 在 `.agents/HANDOFF.md` **顶部**（分隔线下方）追加一条记录
2. `git add` / `git commit`，message 建议带 Agent 前缀：`[cursor]`、`[trae]`、`[codex]`
3. `git push origin master`

## Gitee 私人令牌（可选）

仅当本机 `git fetch` 无凭据时需要。写入 **`.env.local`**（已 gitignore），不要提交：

```bash
GITEE_PRIVATE_TOKEN=你的令牌
```

也可在 shell 临时导出：`export GITEE_PRIVATE_TOKEN=...`

## 文件说明

| 文件 | 用途 |
|------|------|
| `.agents/scripts/sync-gitee.mjs` | 同步与报告脚本 |
| `.agents/HANDOFF.md` | Agent 间异步「留言板」 |
| `AGENTS.md` | Codex / 通用 Agent 入口说明 |
| `.cursor/rules/gitee-collaboration.mdc` | Cursor 自动遵守的协作规则 |

## UI 任务

改界面时额外阅读 `PRODUCT.md`、`DESIGN.md`，或启用 Impeccable skill。
