# M2 首次建模 — 代码修复规格（待执行）

> agent 模式批准后按此文件逐项改代码，改一项勾一项。

## 1. `miniprogram/src/services/entryStorage.ts`

### 1.1 新增 invalidate + 读缓存 + 确认完成

```typescript
function invalidateStageSummary(m: BuildModuleState) {
  m.stageSummary = ''
  m.aiFacts = []
  m.aiHypotheses = []
  m.moduleComplete = false
}

// saveCaptureText 末尾：invalidateStageSummary(m)
// appendFollowUpText 末尾：invalidateStageSummary(m)

export function getLatestStageSummary(entryType: BuildEntryType) {
  const m = loadBuildState().entryMap[entryType]
  if (!m?.stageSummary) return null
  return {
    mainJudgment: m.stageSummary,
    facts: m.aiFacts || [],
    pendingHypotheses: m.aiHypotheses || [],
  }
}

export function confirmModuleComplete(entryType: BuildEntryType) {
  const state = loadBuildState()
  const m = ensureModule(state, entryType)
  m.moduleComplete = true
  saveBuildState(state)
}
```

### 1.2 修改 getEntryStatus / allModulesCompleted

- `completed` → `m.moduleComplete === true`
- `allModulesCompleted` → 四个模块均 `moduleComplete`

---

## 2. `miniprogram/src/services/buildState.ts`

- `BuildModuleState` 增加 `moduleComplete?: boolean`
- `syncBuildProgressToServer` 的 `completedEntries` 仅用 `moduleComplete`
- `hydrateBuildStateFromServer` 对 `remote.completedEntries` 设 `moduleComplete = true`

---

## 3. `miniprogram/src/lib/entryAnalyze.ts`

```typescript
export async function requestEntrySummary(entryType: BuildEntryType, rawText: string) {
  return apiRequest<{
    mainJudgment?: string
    facts?: string[]
    pendingHypotheses?: string[]
    note?: string
  }>('/api/entry/analyze', {
    method: 'POST',
    data: { entryType, rawText, stage: 'summary' },
  })
}
```

---

## 4. `miniprogram/src/packageOnboarding/pages/summary/index.tsx`（核心）

### loadSummary(force?)

1. 无 combined → `mpGoReplace(capture)`
2. `!force` 且 `getLatestStageSummary` 有 mainJudgment → 直接展示
3. 否则 `requestEntrySummary` → 成功 `saveStageSummary`；失败 `setError` + `setSummary(null)`

### actions 三分支

- `loading` → `[]`
- `summary` → 继续下一模块 / 返回补充 / 重新填写（`handleConfirm` 内 `confirmModuleComplete`）
- `error` → 重试整理 / 返回补充 / 重新填写

### UI

- 错误：`soft-card` + 文案 + 与 Web 一致语气
- 成功：保留 insufficient-banner + summary-card + **confirm soft-card**（`config.confirm`）

---

## 5. 导航统一

| 文件 | 改法 |
|------|------|
| `intro/index.tsx` | `navigateTo(basic)` → `mpGoReplace` |
| `basic/index.tsx` | `navigateTo(capture)` → `mpGoReplace` |
| `final-follow-up/index.tsx` | hub/generating 改 `mpGoReplace`；API 失败 toast 不跳转 |

---

## 6. `final-follow-up/index.tsx` 增强

- `submit` 中 API 检查 `res.ok`
- `showLoading` / `hideLoading`
- 失败：`setError` + 底部仍可重试

---

## 影响范围

- hub 完成计数依赖 `moduleComplete`（更准确）
- 服务端 `completedEntries` 仅在用户确认后上报
- 不影响 Web 端任何文件

---

## 验证命令

```bash
cd miniprogram && npm run typecheck && npm run build:weapp
```

开发者工具：重新编译 → 走沟通模块 summary → 模拟 API 失败应见三个底部按钮。
