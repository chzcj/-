# Onboarding 用户心理路径（Web → 小程序）

每页：Web 设计意图 → 小程序实现 → 一致性

## intro — 建立信任、降低门槛

| 意图 | Web UI+文案 | 小程序 | 一致 |
|------|-------------|--------|------|
| 信任 | 黄绿暖色 hero、「先认识你们家」、非问卷语气 | `intro/index.tsx` HiFiBuildHero | 是 |
| 降压 | 单按钮「开始」、说明与网页版同步 | 同左 | 是 |
| 路径 | 进入 basic，不一次问四模块 | navigateTo basic | 是 |

## basic — 轻量信息采集

| 意图 | Web | 小程序 | 一致 |
|------|-----|--------|------|
| 非压迫 | 少量字段、分步 pill | basic 页字段卡 | parity-audit |
| 路径 | → hub | → hub | 是 |

## hub — 四模块全景、进度可控

| 意图 | Web | 小程序 | 一致 |
|------|-----|--------|------|
| 引导四模块 | 四行 entry 列表 + 完成态 | hub entry-row | parity-audit |
| 可控感 | x/4 进度、下一项 CTA | stepLabel + 主按钮 | 是 |

## capture — 倾诉安全感

| 意图 | Web | 小程序 | 一致 |
|------|-----|--------|------|
| 信任 | soft-card + hint-block 专业语气 | 已移植 | 是 |
| 双通道 | record-box 内语音 + 打字 | BuildRecordBox hold-chip | 是 |
| 焦点 | 底部仅「提交」 | 单 primary CTA | 是 |
| 不重复标题 | kicker=stepLabel，prompt 在 light-prompt | 已修复 | 是 |

## follow-up — 补细节不挫败

| 意图 | Web | 小程序 | 一致 |
|------|-----|--------|------|
| 目的可见 | FollowUpCard purpose/directions | FollowUpCard 组件 | 是 |
| 可跳过 | quiet「暂不补充，直接整理」 | bottom quiet 按钮 | 是 |
| 字数 | 无 140 默认限制 | maxlength 4000 | 是 |

## summary — 确认理解、不卡死

| 意图 | Web | 小程序 | 一致 |
|------|-----|--------|------|
| 信息不足 | 多 CTA 继续/修改/补一段 | insufficient-banner + 三按钮 | 是 |
| 路径 | 可进下一模块 | 「先继续下一模块」 | 是 |

## final-follow-up / generating / result

| 页面 | 心理任务 | 状态 |
|------|----------|------|
| final-follow-up | 收尾期待、最后一次补充 | parity-audit |
| generating | 生成中耐心、进度感 | parity-audit |
| result | 解锁四 Tab 成就感 | parity-audit |

## build 三页自检摘要（capture / follow-up / summary）

见 [parity-verification-log.md](./parity-verification-log.md) 2026-07-08 条目。

P0：结构比例 ✓ · 信息层级 ✓ · 卡片位置 ✓ · 视觉焦点 ✓（代码对齐 Web 结构；真机需开发者工具勾选验收）

P1 待真机：字重 820→700（已登记 visual-diff）
