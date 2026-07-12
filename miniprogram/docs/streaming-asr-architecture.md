# 流式输出与 ASR 架构（小程序）

**日期**：2026-07-11  
**目的**：防幻觉 — 改 hook/页面前先对照本数据流。

## 实时 ASR（按住说话）

```
touchStart (≥100ms 防抖)
  → ensureRecordPermission
  → RecorderManager.start PCM 16k（先录后连，帧进缓冲）
  → GET /api/asr/token → wsUrl
  → Taro.connectSocket(wss://asr.cloud.tencent.com/...)
  → onOpen → flush 缓冲 → 实时 send 帧
  → onMessage slice_type 0/1 临时 / 2 定稿 → transcriptRef
touchEnd
  → stopRecorder
  → send { type: 'end' }
  → 等待 slice_type=2 或 2s 超时
  → merge interim + transcript → onSubmit
```

**模拟器**：`platform === 'devtools'` → 不验收 ASR，默认文字模式 + 横幅提示。

**关键文件**：
- `miniprogram/src/hooks/useTencentAsrInput.ts`
- `miniprogram/src/components/hifi/HiFiInputZone/index.tsx`
- `miniprogram/src/components/profile/BuildRecordBox.tsx`
- `app/api/asr/token/route.ts`（引擎 `16k_zh`）

## 交流流式 NDJSON

```
handleSubmit / runTurn
  → abort 旧 RequestTask
  → setTurns(+parent, +ai streaming)
  → scrollToBottom ×3
  → POST /api/daily/stream enableChunked
  → ChunkLineBuffer 粘包拆行
  → parseDailyStreamLine → patchAiTurn
  事件序：onStart → onThinking → onDelta → onProseComplete
         → onSection* → onSectionsComplete → onActions
  → 结束时 flushPending + 补发 finalActions（若未 early）
  → setInputReady(true)
```

**关键文件**：
- `miniprogram/src/services/dailyStream.ts`
- `miniprogram/src/pages/daily/index.tsx`

## 自动滚到底

```
turns / feed 变化 → scrollFingerprint
  → useChatAutoScroll effect → scrollIntoView(anchor)
  → runTurn 内额外 scrollToBottom(32/120/280ms)
```

**关键文件**：
- `miniprogram/src/hooks/useChatAutoScroll.ts`
- `miniprogram/src/pages/daily/index.tsx`
- `miniprogram/src/pages/rehearsal/index.tsx`

## 验收

| 项 | 模拟器 | 真机 |
|----|--------|------|
| ASR | UI/降级文案 | M9 用例 1–2 |
| 流式 | 事件序 + 不白屏 | 弱网可恢复 |
| 自动滚 | 发送后见新气泡 | 同左 |
