# 社区 Skill / MCP（育见小程序）

辅助完善小程序编程，**不替代** [DESIGN.md](../../DESIGN.md) 与 [DESIGN-TOKENS.md](./DESIGN-TOKENS.md)。

## 已安装

### 1. wechat-devtools（瘦 MCP + 胖 Skill）

| 项 | 说明 |
|----|------|
| Skill | `.agents/skills/wechat-devtools/`（Cursor：`.cursor/skills/wechat-devtools` 软链） |
| MCP | 仓库根 `.mcp.json` → `wechat-devtools` |
| 项目路径 | `WECHAT_PROJECT_PATH` = 本仓库 `miniprogram/` |
| CLI | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` |

**本机一次性设置**

1. 打开微信开发者工具 → **设置 → 安全设置 → 服务端口 → 开启**
2. Cursor：Customize → MCP，确认 `wechat-devtools` 已加载（或重载窗口）
3. 导入项目目录必须是 **`miniprogram/`**（不是仓库根）

**典型用法**

```
编译 → 打开页面 → 截图 → 对照设计 Token / 产品意图 → 登记 visual-diff.md
```

在对话中可说：「用 wechat-devtools 对 /pages/daily 做巡检并截图，按 PORTING-SELF-CHECK 写 P0/P1/P2」。

**直达某页（免走完整 onboarding）**

1. 本仓库已在 `project.private.config.json` 配置编译模式（如「预览 · 基础资料」→ `packageOnboarding/pages/basic/index`）。开发者工具里选 **编译模式** 后点编译即可。
2. 或对我说：「打开 basic 页并截图」——需 DevTools 后台运行 + 服务端口已开（见下）。

**Agent 截图工作流**

```
改 miniprogram 某页 → npm run dev:weapp（或 build:weapp）
→ MCP wechat_navigate 跳转到目标 path
→ MCP wechat_screenshot → 截图出现在对话里
```

前提：IDE 已打开项目、**服务端口已开**（本机 **27561**）、**CLI 已登录**（`cli islogin --port 27561` 须为 `login:true`；界面登录 ≠ CLI 登录）。

**注意**
- 勿随意 `wechat_ide(open)`：会 kill 已开的 IDE，导致登出。
- MCP `automator start` 当前未传 `--port`；连不上时在终端：`cli auto --project … --port <服务端口> --auto-port 9420`（本机曾用 27561，重启 IDE 后可能变，以设置页为准）。
- CLI 未登录：`cli login --port <服务端口> -f image -o miniprogram/screenshots/login-qr.png`，微信扫码后再跑 auto。
- 若 `wechat_screenshot` 超时，可用 `ui_debug --action screenshot` 兜底（视口单屏，约 1s）。

### 2. miniprogram-dev（平台知识库）

| 项 | 说明 |
|----|------|
| Skill | `.agents/skills/miniprogram-dev/` |
| 用途 | rpx、权限、分包、提审、Taro 平台差异 |
| **不要** | 让它主导 UI、信息架构、或从零生成育见页面 |

### 3. wechat-miniprogram-designUI（微信官方 UI/UX 规范）

| 项 | 说明 |
|----|------|
| Skill | `.agents/skills/wechat-miniprogram-designui/`（Cursor：`.cursor/skills/wechat-miniprogram-designui` 软链） |
| 上游 | [Billzhouheart/wechat-miniprogram-designUI](https://github.com/Billzhouheart/wechat-miniprogram-designUI) |
| 用途 | 微信官方设计指南、WeUI、rpx/安全区/胶囊避让、TabBar、Modal/Toast、**审核红线**、触控热区 |
| 知识库 | `references/01-基础规范.md` … `07-合规审核.md` |
| **不要** | 用微信品牌绿 `#07C160` 覆盖育见绿；不要按 WeUI 默认样式重做四 Tab |

**典型用法**

- 新页面/改版：查按钮最小热区、自定义导航避让胶囊、隐私弹窗合规
- 提审前：对照 `references/07-合规审核.md` 做 UI 自查
- 与 **Impeccable** 配合：Impeccable 管层级与气质，designUI 管平台硬性规范

**安装 / 更新**

```bash
npx skills add Billzhouheart/wechat-miniprogram-designUI --skill wechat-miniprogram-designUI
ln -sf ../../.agents/skills/wechat-miniprogram-designui .cursor/skills/wechat-miniprogram-designui
```

（已在 2026-07-19 安装于本仓库。）

## 与自有文档关系

```
DESIGN.md / DESIGN-TOKENS.md   ← 育见品牌与 hi-fi 气质（最高）
PORTING.md / web-component-map  ← 页面结构与产品同步
COMMUNITY-SKILLS（本文）       ← 社区工具怎么用
wechat-miniprogram-designUI     ← 微信平台 UI 规范 & 审核
wechat-devtools                 ← 开发者工具自动化
miniprogram-dev                 ← 微信平台百科
Impeccable                      ← 具体页面 audit / polish
```

**颜色冲突时**：育见 `#6f9f56` / 奶油底 优先于 designUI 文档中的微信品牌绿示例。

## 推荐工作流（改版 / 新页面）

```
1. 读当前小程序页面 + DESIGN-TOKENS（产品已变则不必死磕 Web 同路由）
2. 改 UI / 组件（Impeccable 可选 audit）
3. 触控、胶囊、隐私、弹窗 → 查 wechat-miniprogram-designUI
4. wechat-devtools：compile → navigate → screenshot
5. 更新 web-component-map / visual-diff / parity log
```

## 更新上游

**wechat-devtools**

```bash
curl -fsSL -o .agents/skills/wechat-devtools/SKILL.md \
  https://raw.githubusercontent.com/WaterTian/wechat-devtools-mcp/main/.agents/skills/wechat-devtools/SKILL.md
pip3 install -U wechat-devtools-mcp
```

或：`npx -y skills add WaterTian/wechat-devtools-mcp/.agents/skills/wechat-devtools`

**wechat-miniprogram-designUI**

```bash
npx skills add Billzhouheart/wechat-miniprogram-designUI --skill wechat-miniprogram-designUI
```

育见约束见 `.cursor/rules/miniprogram-community-skills.mdc`（含 **UI 修改协议**：有稿复刻 / 无稿按字段设计 / UI 与 Agent 同工）。

## UI 修改协议（摘要）

改页面前必读模块目的与**后端/Agent 输出字段**（类型、字数、分区）。详见 `.cursor/rules/miniprogram-community-skills.mdc`。

| 你有 | 我做 |
|------|------|
| 完整截图/草图 | 复刻式：图 → 代码；你可再调 Agent 输出 |
| 只有参考/描述 | 按现有输出字段重新设计 UI |
| 模糊想法 + 可能要改输出 | UI 与 prompt/contract **同一轮**调整 |

**未读完数据流、未写模块说明，不改代码。**
