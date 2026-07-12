# 稳定性 + UX 审计 2026-07-11

**规则**：`.cursor/rules/miniprogram-stability-ux.mdc`  
**架构**：[`streaming-asr-architecture.md`](./streaming-asr-architecture.md)

## 本轮修复摘要

| ID | 项 | 状态 | 主要改动 |
|----|-----|------|----------|
| P0-D | 发送后自动滚到底 | done | `useChatAutoScroll` + daily/rehearsal 三触发；anchor 24px |
| P0-B | 真机 ASR 稳定性 | done | 先录后连、帧缓冲、优雅 end 2s、touch 100ms 防抖、连接态 UI |
| P0-C | hero 被 mascot 挡 | done | `.has-mascot` padding-right；mascot 缩小 |
| P0-A | 文字裁切/孤字 | done | `word-break`/`text-wrap` on bubble、voice-live、section-body |
| P0-E | 流式不稳定 | done | `dailyStream` flushPending + 补发 finalActions |
| P1-F | Hub 横条两行 | done | `entry-row` flex-start + title/desc block |
| P1-G | 任务展开收起 | done | 整卡 toggle +「收起」+ 提示文案；chip 瘦身 |
| P1-H | 按钮灵动 | done | `motion.scss` active scale 0.98 |
| P1-I | 健康检查 | done | `scripts/health-check.mjs` |
| — | 模拟器 ASR | done | devtools 横幅 + 默认文字模式 |

## Impeccable detect

已运行 `npx impeccable detect miniprogram/src/`（2026-07-11）。CSS chunk order 警告为既有问题，非本轮引入。

## 区域 U1–U7 自检

| ID | 区域 | 结论 |
|----|------|------|
| U1 | 交流 | 自动滚、输入 dock 渐变、ASR 连接态、模拟器提示 |
| U2 | 任务 | 展开/收起明确、chip 28px 高 |
| U3 | 预演 | 自动滚 + disableEntering |
| U4 | 画像 | 未改布局（无 P0 反馈） |
| U5 | Onboarding hub | entry-row 两行 |
| U6 | TabBar | motion active 已统一 |
| U7 | 登录 | has-mascot 防遮挡 |

## 验证

- `npm run release-check` ✅（typecheck + build + audit-share 22/22）
- `health-check.mjs`：readiness `ready:false`（历史 failed jobs）

## 正式发布

见 [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)

## 真机待验收（M9）

- 按住 3–5 秒完整句识别 ×5
- 交流/预演/ capture BuildRecordBox 同链路
