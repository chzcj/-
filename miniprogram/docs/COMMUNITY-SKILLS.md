# 社区 Skill / MCP（育见小程序）

辅助完善小程序编程，**不替代** [PORTING.md](./PORTING.md)。

## 已安装

### 1. wechat-devtools（瘦 MCP + 胖 Skill）

| 项 | 说明 |
|----|------|
| Skill | `.agents/skills/wechat-devtools/`（Cursor 经 `.cursor/skills/wechat-devtools` 软链） |
| MCP | 仓库根 `.mcp.json` → `wechat-devtools` |
| 项目路径 | `WECHAT_PROJECT_PATH` = 本仓库 `miniprogram/` |
| CLI | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` |

**本机一次性设置**

1. 打开微信开发者工具 → **设置 → 安全设置 → 服务端口 → 开启**
2. Cursor：Customize → MCP，确认 `wechat-devtools` 已加载（或重载窗口）
3. 导入项目目录必须是 **`miniprogram/`**（不是仓库根）

**典型用法（对接 PORTING-SELF-CHECK）**

```
编译 → 打开页面 → 截图 → 对照 Web 同路由 → 登记 visual-diff.md
```

在对话中可说：「用 wechat-devtools 对 /pages/daily 做巡检并截图，按 PORTING-SELF-CHECK 写 P0/P1/P2」。

### 2. miniprogram-dev（平台知识库）

| 项 | 说明 |
|----|------|
| Skill | `.agents/skills/miniprogram-dev/` |
| 用途 | rpx、权限、分包、提审、Taro 平台差异 |
| **不要** | 让它主导 UI / 从零生成育见页面 |

育见约束见 `.cursor/rules/miniprogram-community-skills.mdc`。

## 与自有文档关系

```
PORTING.md / DESIGN.md     ← 设计与结构权威
COMMUNITY-SKILLS（本文）   ← 工具怎么用
wechat-devtools            ← 开发者工具自动化
miniprogram-dev            ← 微信平台百科
```

## 更新上游

网络可用时：

```bash
# Skill
curl -fsSL -o .agents/skills/wechat-devtools/SKILL.md \
  https://raw.githubusercontent.com/WaterTian/wechat-devtools-mcp/main/.agents/skills/wechat-devtools/SKILL.md
# MCP 包
pip3 install -U wechat-devtools-mcp
```

或：`npx -y skills add WaterTian/wechat-devtools-mcp/.agents/skills/wechat-devtools`
