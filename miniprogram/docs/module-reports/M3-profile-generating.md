# 模块 M3：AI 画像生成

**状态**：P0/P1 已修复（2026-07-08）

## 范围

| Web | 小程序 |
|-----|--------|
| `/profile/generating` | `packageOnboarding/pages/generating` |
| `/profile/result?onboarding=1` | `packageOnboarding/pages/result` |

## 已修复

| ID | 问题 | 文件 |
|----|------|------|
| M3-01 | generating 无门禁，未完成四模块也能进入 | `generating/index.tsx`, `entryStorage.ts` `canAccessProfileGenerating` |
| M3-02 | 已有画像未跳转 result | `generating/index.tsx` GET `/api/profile/built` |
| M3-03 | 错误态仅页面内 pill，无底部 actions | `generating/index.tsx` 重试 + 返回采集 |
| M3-04 | 未轮询 deep-model-status | `profilePipeline.ts` `waitForDeepModelDigest` |
| M3-05 | completedEntryCount 未用 moduleComplete | `profilePipeline.ts` |
| M3-06 | result 无 loading / 空态 / 错误出口 | `result/index.tsx` |
| M3-07 | result 文案与 Web onboarding 不一致 | hero「可以开始交流和预演」+「开始交流」 |
| M3-08 | result 未展示 supportFocus | `result/index.tsx` |

## 仍登记 P2

- StructuralTensionCard、证据标签、profile 子页入口（Web result 有，小程序简化）

## 回归

- [ ] 四模块 + final-follow-up → generating → result → 开始交流进 daily Tab
- [ ] generating 中途失败 → 重试 / 返回 hub
- [x] typecheck + build:weapp
