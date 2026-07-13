# 育见（yujian）

帮家长看见孩子，而不是只看见问题。

**育见**是一款帮助家长理解青春期孩子的 AI 产品：把真实家庭片段转化为更深的孩子理解，支持日常交流、场景预演与长期画像（SecondMe）。品牌对外用 **育见**；代码与文档中的 ChildOS / 心镜为同一产品历史名。

| 端 | 地址 |
|----|------|
| Web / BFF | [https://yujian.yihe.site](https://yujian.yihe.site) |
| 微信小程序 | 本地 `miniprogram/` 构建后上传（与 Web 共用 BFF） |

---

## 产品说明

### 为谁做

焦虑但有反思能力的家长——日常要管作业、管手机，更想真正理解孩子。典型场景：

- 在手机上快速记录或**按住说话**讲一段真实片段
- 获得比通用 AI 更具体、更贴家的理解（机制链 + 证据），而非泛泛建议
- 沟通前**预演**自己要说的话，看孩子可能会怎么听
- 长期积累片段，形成只属于这个孩子、这个家庭的**成长模型（SecondMe）**

### 产品不做什么

- 不给家长打分、不做测评暗示
- 不急着给「标准答案」或说教式建议
- 不收集手机号 / 头像 / 昵称（小程序登录仅 `wx.login` 识别账号）

### 主界面：四 Tab

上线主体验以 **hi-fi 四 Tab** 为准（Web：`HiFiMainShell`；小程序同构）。

| Tab | Web | 小程序 | 价值 |
|-----|-----|--------|------|
| 交流 | `/daily` | `pages/daily` | 说真实片段 → 流式深度理解 |
| 任务 | `/tasks` | `pages/tasks` | 「今晚可试」小步行动 |
| 预演 | `/rehearsal` | `pages/rehearsal` | 场景模拟 + 亲子对话录音分析 |
| 画像 | `/family-profile` | `pages/profile` | 孩子画像、证据、机制链、验证点 |

旧紫色 `AppShell` 与 `/home` 等路由已废弃，由 `middleware.ts` 重定向到 `/daily`。

### 小程序 Onboarding（体验优先建档）

**先体验、后登录**：首屏只有「开始」+ 隐私勾选，不强制微信登录。

```
开始（隐私）→ 介绍页 → 四模块 Hub
  → 点模块进采集前：微信登录（可暂不登录，留在 Hub）
  → 四模块采集（文字 / 按住说话）→ 生成画像 → 结果页
  → 填写孩子昵称/年级 → 四 Tab
```

- 孩子基础信息（昵称、年级）在**画像生成之后**再填，建档完成（`onboardingComplete`）后才解锁四 Tab
- 提审要点见 [miniprogram/docs/REVIEW-SUBMISSION.md](miniprogram/docs/REVIEW-SUBMISSION.md)

### 语音输入

| 场景 | 实现 |
|------|------|
| 交流 / 预演 / 四模块 **按住说话** | 讯飞实时转写（小程序直连 wss；BFF 签发 URL） |
| 按住时实时字幕 | 输入条上方浅绿通栏，显示转写进度（不改 ASR 底层） |
| **亲子整段录音** | 本地 mp3 → 腾讯文件识别（`/api/rehearsal/dialogue-transcribe`） |

语音链路已验收锁定，改动须先征得同意（`.cursor/rules/voice-input-locked.mdc`）。

### 深度建模（SecondMe）

家长持续输入真实生活片段 → 多模块共建孩子理解 → 前台分析锚定家庭事实与机制闭环。介绍页对产品能力的概括：教育观念、陪伴、性格、学习、兴趣、情绪、家庭矛盾与过往方法，逐步形成**只属于这个孩子与家庭的成长模型**。

更完整边界见 [PRODUCT.md](PRODUCT.md)（含 **功能 × 记忆 × Agent** 对照表）、[docs/product/deep-modeling.md](docs/product/deep-modeling.md)。

---

## 设计说明

### 创意方向：「即时回声」

育见不是让人长时间沉浸的 App，而是家庭场景里的**即时工具**：遇到具体时刻 → 打开 → 输入或说话 → 得到更深理解 → 离开。每屏尽量在十几秒内完成一件事：输入、理解或决定下一步。

### 品牌性格

**简洁 · 清晰 · 沉浸**（沉浸指内容为主、系统 UI 退后，不是全屏霸占）

- **简洁**：少装饰、少系统废话；每个元素有理由
- **清晰**：不靠说明书，靠按钮与布局引导下一步
- **温柔可信**：面向「已经很努力、想理解孩子」的家长，不病理化、不急着建议

### 视觉系统（hi-fi）

| 维度 | 规范 |
|------|------|
| 主色 | 草地绿 `#6f9f56` / `#9dcc75`，用于主按钮与高关注元素 |
| 页面底 | 暖奶油渐变 `#f8f6e5`，非冷灰、非纯白 |
| 卡片 | 半透明纸感 `rgba(255,255,247,0.88)`，轻阴影 + 细边框 |
| 正文 | `#202633` / 辅助 `#5c616d` / 弱化 `#868b94` |
| 圆角 | 卡片 24px、行块 20px、按钮/芯片 999px |
| 字体 | 系统中文栈（PingFang 等）；标题约 17–26px，正文 15px / 行高 1.68 |

### 布局壳层

- **主站**：`HiFiMainShell` — 四 Tab + 底部 `input-dock`（交流/预演）
- **建档**：`HiFiBuildShell` — 进度条 + 底部主操作，子包 onboarding
- **交流页**：单滚动容器 + 流式气泡；预演 active 步独立对话滚动区

### 流式交流形态（Web BFF）

```
thinking 四宫格 → prose 流式 → section 卡片（≤3）→ actions → 可发下一条
```

契约：[docs/contracts/daily-stream-events.md](docs/contracts/daily-stream-events.md)

### 明确拒绝

长篇系统说明、复杂多级菜单、评分暗示、冷灰临床感、ChatGPT 式万能对话框、恢复旧紫色心镜布局。

完整 Token 与组件见 [DESIGN.md](DESIGN.md)（含 **组件 × 记忆来源** 对照）、[miniprogram/docs/DESIGN-TOKENS.md](miniprogram/docs/DESIGN-TOKENS.md)、[design-reference/README.md](design-reference/README.md)。

---

## 代码仓库

| 远程 | 地址 | 用途 |
|------|------|------|
| **origin** | https://gitee.com/heartlab/yujian | 主协作，分支 `master` |
| **github** | `git@github.com:chzcj/-.git` | 镜像 / 对外备份 |

```bash
git clone https://gitee.com/heartlab/yujian.git
cd yujian && npm install
npm run sync:gitee    # 开工前：同步 + 读 HANDOFF
```

收工：`[cursor]` 前缀 commit → `git push origin master` → 可选 `git push github master`。  
协作流程：[AGENTS.md](AGENTS.md) · [.agents/README.md](.agents/README.md)  
**勿提交** `.env.local`、密钥、SSH 密码。

---

## 本地开发

```bash
npm install
npm run asr:dev              # Web：Next + WebSocket ASR（server.js）
cd miniprogram && npm install && npm run build:weapp
```

- Web：http://localhost:3000/daily  
- 小程序：微信开发者工具打开 **`miniprogram/`**（`miniprogramRoot: dist/`）  
- 检查：`npm run check` · `curl -s http://localhost:3000/api/readiness`

环境变量见根目录 `.env.local`（`DATABASE_URL`、`FAST_AI_*`、`IFLYTEK_*`、`TENCENT_*`、`INTERNAL_API_TOKEN` 等）。

```bash
export SSH_HOST="ubuntu@…" SSH_PASS="…" AUTH_TOKEN="…"
npm run deploy               # 仅 Web/BFF；小程序需本地 build:weapp 后上传
```

---

## 目录速览

```
app/                 # Next.js 页面与 BFF
miniprogram/         # Taro 微信小程序
src/lib/server/      # 对话、记忆、ASR、任务队列
server.js            # 生产入口 + Web ASR WebSocket
prompts/             # Agent 提示词
docs/                # 契约、提审、产品文档
.agents/HANDOFF.md   # 多 Agent 协作留言
```

## 相关文档

- [PRODUCT.md](PRODUCT.md) — 产品边界全文  
- [DESIGN.md](DESIGN.md) — 设计系统全文  
- [docs/architecture/agent-memory-workflow.md](docs/architecture/agent-memory-workflow.md) — **底层架构图**（Agent / SP / Job / 记忆）  
- [miniprogram/README.md](miniprogram/README.md) — 小程序构建与 ASR 域名  
- [miniprogram/docs/REVIEW-SUBMISSION.md](miniprogram/docs/REVIEW-SUBMISSION.md) — 微信提审  
