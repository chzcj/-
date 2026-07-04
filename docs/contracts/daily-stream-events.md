# BFF 流事件契约 — DailyStreamEvent

> 共享类型：`src/types/daily-stream.ts` 的 `DailyStreamEvent`
> 后端 emitter：`app/api/daily/stream/route.ts` 的 `send(event: DailyStreamEvent)`
> 前端 parser：`src/lib/daily/dailyStreamClient.ts` 的 `parseDailyStreamLine`

## 事件清单与顺序

| 事件 | 何时 emit | 前端如何处理 | 谁写 | 谁读 |
|---|---|---|---|---|
| `start` | 收到请求立即 | 记 traceId，进入 created | route.ts:48 | dailyStreamClient.ts:129 |
| `thinking` | orchestration 完成后（仅一次） | 渲染四宫格 chips | route.ts:44 | :127 |
| `delta` | prose 流式每个 token | 累积正文，渲染流式 | route.ts:60 | :125 |
| `prose_complete` | prose 流结束 | 切换状态 prose_complete | route.ts:63 | :131 |
| `section_start` | 某 section 开始 | 插入空 section 气泡 | route.ts:65 | :135 |
| `section_delta` | section 增量 | 更新 streamingText | route.ts:68 | :137 |
| `section_complete` | 某 section 完成 | 落定该 section | route.ts:71 | :139 |
| `section_error` | section 生成失败 | 标记错误，可重试 | route.ts:74 | :133 |
| `sections_complete` | 全部可见 section 完成 | 展示 actions | route.ts:78 | :141 |
| `sections` | hidden 填完后全量重发 | 合并 hidden 内容（深度展开用） | route.ts:81 | :143 |
| `actions` | sections_complete + 300ms | 渲染动作条 | route.ts:84 | :145 |
| `final` | 全部完成 | 落库 turn，解锁输入 | route.ts:88 | :147 |
| `error` | 异常 | 提示，解锁输入 | route.ts:161 | :153 |

## 硬规则

- 后端禁止 emit 本表外的事件类型（TS 编译期保障：`send` 参数类型为 `DailyStreamEvent`）
- 前端 parser 必须处理本表全部事件类型（TS 保障：`StreamEvent = DailyStreamEvent`）
- 新增事件必须同时改 `daily-stream.ts` + emit + parse，否则 TS 报错
- `final` 必须是最后一个事件（除 error 外）

## final payload 字段

| 字段 | 类型 | 谁写 | 谁读 |
|---|---|---|---|
| `text` | string | route.ts:90 | dailyStreamClient 落 acc |
| `sections` | DailySection[] | route.ts:91 | 落 finalSections |
| `actions` | DailyAction[] | route.ts:92 | 落 finalActions |
| `linkedAreas` | string[] | route.ts:93 | 落 finalLinked |
| `cards` | DailyCards | route.ts:94 | 落 finalCards |
| `traceId` | string | route.ts:95 | 关联 memory-status 查询 |
| `runtime` | object | route.ts:96 | 调试日志 |
| `timing` | object | route.ts:97 | TTFT/耗时日志 |
