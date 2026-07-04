# 前端状态机契约 — DailyTurnState

> 共享类型：`src/types/daily-stream.ts` 的 `DailyTurnState` 与 `DAILY_TURN_STATE_TRANSITIONS`

## 状态流转

```
created
 → streaming_prose        (收到 delta)
 → prose_complete         (收到 prose_complete)
 → streaming_sections     (收到 section_start)
 → sections_complete      (收到 sections_complete)
 → actions_ready          (收到 actions)
 → final                  (收到 final 或 error)
```

## 每状态 UI 表现

| 状态 | 正文 | section | actions | 输入框 | 打断按钮 |
|---|---|---|---|---|---|
| created | 占位 | - | - | disabled | - |
| streaming_prose | 流式渲染 | - | - | disabled | 可见可点 |
| prose_complete | 落定 | - | - | disabled | 可见 |
| streaming_sections | 落定 | 流式渲染 | - | disabled | 可见 |
| sections_complete | 落定 | 落定 | - | disabled | - |
| actions_ready | 落定 | 落定 | 渲染 | **解锁**（实现：onActions 即 setInputReady(true)） | - |
| final | 落定 | 落定 | 落定 | 解锁 | - |

## 硬规则

- 输入框在 `actions_ready` 解锁（page.tsx:145，sections+actions 都到即可发下一条，不必等 hidden/final）
- `actions` 必须在 `sections_complete` 之后才展示（3A 顺序，daily-turn-bff.ts 300ms 缓冲；前端 showActions 需 sectionsComplete）
- `error` 直接跳 `final`，解锁输入
- 用户打断（abort）→ 状态置 `final`，标记 `interrupted`
- 状态机由 `DAILY_TURN_STATE_TRANSITIONS` 驱动，前端不得手写散落 if/else

## 谁写谁读

- 写状态：`app/daily/page.tsx`（按 event 转移）
- 读状态：`app/daily/page.tsx`（控制输入框 disabled / actions 显示 / 打断按钮）
- 共享转移表：`DAILY_TURN_STATE_TRANSITIONS`（前后端可复用做 contract test）
