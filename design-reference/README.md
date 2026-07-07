# UI 设计参考

高保真原型来源：https://github.com/xubaoyue7577-sudo/pages  
线上预览：https://xubaoyue7577-sudo.github.io/pages/

本地已有 `design-reference/pages/index.html`（约 400KB，网络慢时可能不完整；完整版约 1.2MB）。

```bash
git clone --depth 1 https://github.com/xubaoyue7577-sudo/pages.git design-reference/pages
# 或
curl -L -o design-reference/pages/index.html \
  https://raw.githubusercontent.com/xubaoyue7577-sudo/pages/main/index.html
```

## 已确认的产品决策（2026-06）

- 只改 Next.js 网页，全量换肤为黄绿高保真
- 底部 Tab：**交流｜任务｜预演｜画像**
- 五入口 `/profile/build` 保留结构，只换皮
- 登录：手机号 + 密码（暂无短信）
- 旧页面（观察/冲突/记录/诊断/后台等）从导航隐藏并重定向

## 育见新增 UI 白名单（对齐 hifi 时保留逻辑，只调样式）

相对 `design-reference/extracted/` 参考，以下为实现层新增，**禁止因像素对齐而删除**。设计原则与 token 见根目录 [`DESIGN.md`](../DESIGN.md)。

- 交流：流式打断、section 重试、深度展开卡、`/daily/how-to-speak`、action 条、starter chips
- 语音：全屏 `recording-mask`
- 预演：4 轮检查点 modal、第三块「您可以这样说」、system hint
- 任务：反馈顶栏返回 + `task-submit-dock`
- 画像：卡片 accordion 展开、内联账号编辑（非参考齿轮 settings）
- 采集：`entry-row` hub 列表、`HiFiBuildHero` mascot、`BuildFlowGuard` / `OnboardingGuard`

**CSS 真源**：`design-reference/extracted/2-main-app.css`、`design-reference/hifi-build.css` → `npm run prebuild` 生成 scoped CSS。勿以 `index.full.html` 内联 token（28px）为准。

```bash
node scripts/extract-hifi-pages.mjs
node scripts/scope-hifi-app-css.mjs
node scripts/scope-hifi-build-css.mjs
```
