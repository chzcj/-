# 模块 M2：首次信息采集 / 四模块建模

**状态**：M2 P0 已修复（2026-07-08），待真机回归验证  
**Web 标准**：`/profile/build/*` → `EntryCapturePage` / `EntryFollowUpPage` / `EntrySummaryPage`

---

## 产品功能模块地图（M2）

| 字段 | 内容 |
|------|------|
| 模块名称 | 首次信息采集 / 四模块建模 |
| 核心用户目标 | 分四段讲真实家庭片段 → AI 追问 → 模块整理 → hub → 收尾追问 |
| Web 页面 | intro, basic, hub, `{module}`, follow-up, summary, final-follow-up |
| 小程序页面 | `packageOnboarding/pages/*` 对应 8 页 |
| 核心组件 | `HiFiBuildShell`, `BuildRecordBox`, `FollowUpCard` |
| 核心接口 | `POST /api/entry/analyze` (stage=entry\|summary), `GET/POST /api/profile/build-state` |

---

## 已确认一致部分

- 四模块顺序 daily → homework → communication → family
- capture 提交后 `stage=entry` 判断是否追问
- follow-up 多轮上限 3（`MAX_ENTRY_FOLLOW_UP_ROUNDS`）
- hub 展示四模块状态；`mpGoReplace` 已用于 hub/capture/follow-up 部分路径
- `saveBuildState` 自动触发 `syncBuildProgressToServer`

---

## 数据状态问题（待修复）

| 问题 | Web | 小程序 | 修复方案 |
|------|-----|--------|----------|
| summary 缓存 | `getLatestStageSummary` 先读缓存 | 每次打 API | 新增 `getLatestStageSummary`，load 时先读 |
| 确认后才算完成 | `markEntryCompleted` 在点继续时 | `stageSummary` 存在即 completed | 新增 `moduleComplete` + `confirmModuleComplete` |
| 文本变更后旧 summary | 重新采集会重新整理 | 未失效缓存 | `saveCaptureText`/`appendFollowUpText` 时 `invalidateStageSummary` |
| summary 失败 | 错误卡 + 重试 | 无按钮 | 错误态 fallback actions |

---

## 用户流程问题（待修复）

| 问题 | 修复 |
|------|------|
| 第 3–4 模块 navigateTo 栈满 | intro/basic/final-follow-up 改 `mpGoReplace` |
| summary 503 后无法继续 | 错误态：重试 / 返回补充 / 重新填写 |
| final-follow-up 失败仍跳转 generating | API 失败 toast + 保持在本页 |

---

## 页面交互问题（待修复）

| 页面 | 问题 | 修复 |
|------|------|------|
| summary | loading 时无按钮 OK；错误时也无按钮 | 分离 successActions / errorActions |
| summary | 无重试 | soft-card + 重试按钮 |
| follow-up | API 失败仅有 chip 重试 | 错误时 actions 保留 skip |
| capture | API 失败仅 toast | 可选内联 error 状态（P1） |
| final-follow-up | 无 loading mask | `Taro.showLoading` |

---

## UI 问题（本批 P1，P2 登记）

| 页面 | 差异 | 本批 |
|------|------|------|
| summary | 缺 `config.confirm` 软卡 | 添加 soft-card |
| summary | 缺 AuthorityInsightCard | P2 登记 visual-diff |
| follow-up | 已改 text-link 返回 | 已做 |
| basic | Input 用 `record-textarea` 类 | 保持，核对高度 ≥88rpx |

---

## Bug 列表与修复映射

| ID | 优先级 | 修改文件 | 修改原因 |
|----|--------|----------|----------|
| M2-01 | P0 | `summary/index.tsx` | 对齐 Web 错误态 + fallback actions |
| M2-02 | P0 | `entryStorage.ts`, `summary/index.tsx` | 读缓存再请求 |
| M2-03 | P0 | `buildState.ts`, `entryStorage.ts`, `summary/index.tsx` | moduleComplete 确认门槛 |
| M2-04 | P0 | `entryStorage.ts` | invalidate 旧 summary |
| M2-05 | P0 | `intro`, `basic`, `final-follow-up` | mpGoReplace |
| M2-06 | P0 | `final-follow-up/index.tsx` | API 错误处理 |
| M2-09 | P1 | `summary/index.tsx` | confirm 软卡 |

---

## 执行后回归清单

- [ ] 新用户：intro → basic → 四模块全流程（需开发者工具验证）
- [ ] 半完成：hub 续做、hydrate 后状态正确
- [x] summary API 失败：可重试 / 返回补充 / 重填
- [x] 修改 capture 文本后 summary 重新请求（invalidateStageSummary）
- [x] 点「继续下一模块」后 hub 显示已完成（moduleComplete）
- [x] `npm run typecheck && npm run build:weapp` 通过

## 完成标准（M2）

- [x] Web 功能一致（P0 路径）
- [x] 数据状态一致（moduleComplete + 缓存 + invalidate）
- [x] 用户流程一致（mpGoReplace + 错误出口）
- [x] 页面交互一致（错误态按钮 + loading）
- [ ] UI 体验接近一致（AuthorityInsightCard 仍 P2）
