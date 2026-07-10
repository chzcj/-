# Porting 完成后自检（必跑）

上一阶段声称完成迁移后，**先跑本清单，再开新页**。

## Step 1 — Web Design Token 核对

从 `DESIGN.md` + `hifi-app.css` + `hifi-build.css` **总结** Token 表（见 [DESIGN-TOKENS.md](./DESIGN-TOKENS.md)），对照 `tokens.scss`：

- 已映射 / 缺失 / 偏离未登记 visual-diff

## Step 2 — 小程序映射规则

| Web | 小程序 |
|-----|--------|
| px @ 390 | rpx（×2） |
| font-size | 系统字体视觉等效，±1px 可登记 P1 |
| flex/grid | View + flex；scroll-view 高度链 |
| safe-area | env + 壳层统一 |
| backdrop-filter | 半透明替代 → visual-diff |

## Step 3 — P0 / P1 / P2

**P0（任一项失败 = 未完成）**

- [ ] 页面结构比例
- [ ] 信息层级
- [ ] 卡片/气泡位置与对齐
- [ ] 主要视觉焦点（hero、主 CTA、当前步骤）

**P1**：字号层级、间距、圆角、触控 ≥ 44px  
**P2**：阴影、装饰、动画（缺则登记 diff）

## Step 4 — Onboarding 设计意图

每页写清：信任建立 / 降压 / 引导四模块 → 小程序是否同心理路径。详见 [onboarding-ux-path.md](./onboarding-ux-path.md)。

## Step 5 — 平台陷阱扫描

navigationBar、button 默认、textarea、字体行高、rpx、safe-area、双 scroll、Tab `switchTab` — 每项标：通过 / 已修复 / 已登记 diff。

## Step 6 — 逻辑路径

四 Tab 门禁、daily stream 事件序、thinking→prose→section→actions、关键交互未删。

## Step 7 — 自检报告模板

### 1. 范围
本次审计：___

### 2. Web Token 摘要（表格）

### 3. 小程序映射与偏差
- 已对齐
- 已登记 visual-diff（路径）
- 待修（P0/P1/P2）

### 4. 对照验收

| 验收点 | Web | 小程序 | 结果 |
|--------|-----|--------|------|
| 第一眼品牌感 | | | |
| 页面结构 | | | |
| 操作路径 | | | |
| 信息重点 | | | |
| 使用感受 | | | |

### 5. 结论
- [ ] 可进入下一页
- [ ] 需继续修本轮（P0 列表）

### 6. 文档
- [ ] web-component-map.md
- [ ] visual-diff.md
- [ ] tokens.scss / DESIGN-TOKENS.md

---

## 附录 A — 短版督促

1. 输出 Web Token 表（不抄 CSS）
2. 对照 tokens.scss + visual-diff.md
3. P0 四项必须过
4. 微信陷阱扫描
5. 给自检报告表格

## 附录 B — 单页深度审计

Part A 设计意图 → Part B Token → Part C P0 对照 → Part D 结论

## 附录 C — 全站收口

见 [parity-verification-log.md](./parity-verification-log.md) 全站表 + 用户旅程测试。
