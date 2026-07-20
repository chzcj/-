# HandbookPack 全链路追踪

画像 Tab「成长手账」改版的数据契约：`GET /api/profile/handbook-pack` 一次拉齐 hero + stats + handbook + memoryFeed + highlightMoments + timeCapsule。

## 生产 → 存储 → 消费

| 字段 | 生产者 | 存储 | 消费者 |
|------|--------|------|--------|
| `hero.childName` | onboarding / child basic | child profile | MP `PortraitMemoryHero` 标题 |
| `hero.monthLabel` | `week-utils.getMonthLabel()` | — | MP hero 标题 |
| `hero.heroCopy` | `weeklyHandbookSynthesizer` 或 fallback | `family_handbook_snapshot` | MP hero 副文案 |
| `hero.pageCount` | `handbook-admission.computePageMetrics()` 终身 `family_handbook_pages` 计数 | `family_handbook_pages` | MP 页数印章 |
| `hero.weekPageDelta` | 同上（本周新准入） | `family_handbook_pages` | MP 印章 delta |
| `stats.highlightCount` | `dailyPortraitRefresh` → `highlightMoments` | `daily_ui_snapshot` | MP hero stat |
| `stats.completenessPct` | `built_profile_snapshots.completeness` | DB | MP hero stat / tile progress |
| `stats.memoryCount` | 全历史准入页数 | `family_handbook_pages` | MP hero stat / 手账记忆列表 |
| `handbook.*` | `weeklyHandbookSynthesizer` | `family_handbook_snapshot` | MP `WeeklyHandbookCard` + `/handbook` |
| `memoryFeed[]` | `buildMemoryFeedForWeek()` ← 准入层 + displayLine | `family_handbook_pages` + job 快照 | MP `/memories` |
| `highlightMoments[]` | `dailyPortraitRefresh` | `daily_ui_snapshot` | MP `/moments` |
| `timeCapsule` | `timeCapsuleCompare` agent | `family_time_capsule` | MP/Web time-capsule 入口 teaser |
| `timeCapsuleSnapshot` | 同上（完整 then/now） | `family_time_capsule` | MP/Web time-capsule 详情页 |
| `watermark.*` | `handbook-pack-builder` | — | MP 刷新提示（后续） |

## 刷新频率

| 路径 | 触发 | 行为 |
|------|------|------|
| `POST /api/account/daily-refresh` | MP Tab `useDidShow`（1.5s 防抖） | 同步 `dailyPortraitRefresh`；异步 enqueue `weekly_handbook_update` + `family_memory_feed_rebuild` + `time_capsule_update` |
| `GET /api/profile/handbook-pack` | MP Tab 并行拉取 | 读 snapshot + feed + handbook + capsule 组装 |
| `GET /api/profile/hub` | MP Tab 并行拉取 | portraitCards + structuralTensions + highlightMoments |

**不变量**：每次进 Tab 仍调 `daily-refresh`（与旧 portrait 一致），手账 Job 为异步追加，不替代 daily refresh。

## 写入路径

| 来源 | API / Job | `sourceKind` |
|------|-----------|--------------|
| 家长随笔 | `POST /api/profile/journal` | `journal` on `DailyInteractionUpdate` |
| 交流轮次 | turn pipeline | turn_events（**不直接**进 `family_handbook_pages`；仅 episode 升格 high-value atom 可准入） |
| 任务反馈 | task pipeline | daily_updates → `task_shine` 候选 |
| 预演语音 | rehearsal ASR（只读消费） | memoryFeed type=`voice` |

## Agent 矩阵

| Agent | SP | 产出 |
|-------|-----|------|
| `dailyPortraitRefresh` | `prompts/front/dailyPortraitRefresh.md` | L1 tile summary + L2 lead + highlightMoments |
| `weeklyHandbookSynthesizer` | `prompts/front/weeklyHandbookSynthesizer.md` | WeeklyHandbook JSON |
| `memoryMomentLight` | `prompts/front/memoryMomentLight.md` | 记忆详情轻解读 |
| `timeCapsuleCompare` | `prompts/front/timeCapsuleCompare.md` | TimeCapsuleSnapshot |

## UI 字段映射（L1/L2/L3）

| Mock | BFF 字段 | 页面 |
|------|----------|------|
| `.portrait-tile .cap` | `portraitCards.*.summary` | MP tile strip |
| `.ic-body` / handbook lead | `portraitCards.*.lead` | `/card` L2 |
| accordion sections | `portraitCards.*.sections` | `/card` L3 |
| 闪光时刻 | `highlightMoments[]` | `/moments` |

## 验收脚本

```bash
node scripts/test-handbook-pack.mjs   # 待补：handbook-pack 结构断言
npm run typecheck
cd miniprogram && npm run build:weapp
```
