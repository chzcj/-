# 前端请求契约 — POST /api/daily/stream

> 共享类型：`src/types/daily-stream.ts` 的 `DailyStreamRequest`

## Request Body

| 字段 | 类型 | 必填 | 谁生成 | 谁消费 | 说明 |
|---|---|---|---|---|---|
| `text` | string | ✅ | 前端 daily/page.tsx 输入框 | route.ts:18 | trim 后非空，空则 400 EMPTY_INPUT |
| `warmTurn` | boolean | ❌ | 前端（同线程后续轮 true） | route.ts:20 → orchestration pipeline.ts:234 | true 跳向量检索，复用首轮 packet |
| `recentSectionIds` | string[] | ❌ | 前端（已展示 section id） | route.ts:21 → daily-turn-bff.ts:145 applySectionPolicy | 去重/降级已展示 section |
| `maturityLevel` | string | ❌ | 调试 | route.ts:19 | 覆盖成熟度 |

## Response

`Content-Type: application/x-ndjson`，每行一个 `DailyStreamEvent`（见 daily-stream-events.md）。

## 谁写谁读

- 写：`app/daily/page.tsx`（fetch body）
- 读：`app/api/daily/stream/route.ts`（request.json）
- 共享类型：`DailyStreamRequest`（前后端不得各自定义 shape）
