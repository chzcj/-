# 手账内容质量 · 30轮要求复盘 & 预演迁移总计划

> 2026-07-20 | 供下一 Agent / 用户验收对照

## 一、问题是否解决（诚实状态）

| 层级 | 状态 | 说明 |
|------|------|------|
| 根因诊断 | ✅ | 注入字段错（title 当 evidence、whyIncluded 当正文） |
| 后端管道 | ✅ | quality-gate、rawEvidence 落库、purge、orchestrator、溯源 API |
| 老用户刷新 | 🟡 | 已入队全历史链；需 job 跑完 + 真机验收 |
| 小程序详情可读 | 🟡→✅ | 本轮补「02 原文摘录」+ 无原话占位提示 |
| 刷新 banner | 🟡→✅ | 改为仅 job 在途时显示，不再 health 永久 true |
| 预演 mock 完整 | 🟡 | 三屏骨架有；5 场景 / Hero 麦克风 / dialogue 像素未齐 |

**结案标准（用户 eyes）**：列表 displayLine 能独立读懂；详情 01+02 有实质内容；Weekly Top3 类型多样；无「无意义/交流」类坏页。

---

## 二、30轮要求清单

### 手账 / 记忆 / 画像
- [x] Hero→全历史；Weekly→滚动7天
- [x] Top3 preview + 策展打分
- [x] 子页 SWR
- [x] 时间胶囊 kicker 调整
- [x] completeness / progress 分离
- [x] tile-cap / insight 像素
- [x] episode 寒暄 gate
- [x] memory_write 批量 flush
- [ ] **内容可读（用户验收）**
- [x] 筛无意义（gate + purge）
- [x] 老用户 orchestrator + full backfill
- [x] 坏页 delete + re-admit

### 预演（rehearsal-flow-preview.html）
- [ ] Screen1：5 场景 + 频次 + Hero 麦克风 CTA
- [x] Screen2：brief API（situation + understanding）
- [x] Screen3：dialogue + hideTabBar（MP）
- [ ] 动态场景 >3（morning/grades 等）
- [ ] 预演 turn → handbook enriched 闭环验收

---

## 三、犯过的错

1. **先 UI 后内容** — 导航/SWR 先于准入质量门  
2. **rawEvidence 取错** — trajectory 用 title  
3. **不落库** — 润色吃内存 rawFallback  
4. **详情混字段** — body=whyIncluded  
5. **无 handbook gate** — 4 字 rehearsal 也进  
6. **LLM 救烂输入** — truncate 冒充 displayLine  
7. **老用户假设有数据** — 仅 7 天 scan  
8. **MP 详情缺原文块** — Web 有、MP 无（已补 2026-07-20）

---

## 四、字段契约（不可再错）

```
准入候选 rawEvidence + contextSummary
  → saveHandbookPage（必存 rawEvidence）
  → handbookLineEditor → displayLine / teaser / whyIncluded
  → L2 列表 / Weekly Top3
  → buildMemoryMomentDetail
       whyIncluded → 01
       evidenceBody → 02 原文摘录
       keyQuotes → 03
       interpretation → ✦
```

---

## 五、预演 mock 逐步任务（极细）

### Step 0 · 契约冻结（1 PR）
- [ ] 复制/锁定 `design-reference/rehearsal-flow-preview.html`
- [ ] 输出 `docs/contracts/rehearsal-flow-contract.md`：每屏每块 ↔ API 字段表
- [ ] 用户确认：5 场景固定 seed vs 动态 pain point

### Step 1 · 场景列表 BFF（1 PR）
- [ ] `GET /api/rehearsal/scenes` 返回 ≥5 场景（动态优先）
- [ ] `mentionCountHint` **代码统计**，LLM 只写 lede/title
- [ ] 加厚 `rehearsalSceneHydrator.md`（≥120 行）
- [ ] 单测：无 digest 时 fallback 3 场景、无假频次

### Step 2 · 摘要屏 BFF（1 PR）
- [ ] `POST /api/rehearsal/brief` 返回 bullets 3 条（非一段糊字）
- [ ] 加厚 `rehearsalSceneBrief.md`
- [ ] 输入含 childQuotes / entryFacts

### Step 3 · MP UI 屏1（1 PR）
- [ ] voice-hero 麦克风视觉 + CTA（不改 ASR 文件）
- [ ] 5× scene-card + section-lede
- [ ] rpx 对照 mock L900–985

### Step 4 · MP UI 屏2（1 PR）
- [ ] info-card ×2 + insight-list `<li>` ×3
- [ ] brief-sub 展示 mentionCountHint

### Step 5 · MP UI 屏3（1 PR）
- [ ] dialogue-head「和{childName}预演」
- [ ] hideTabBar + input-dock 布局
- [ ] child-insight 侧栏样式对齐 mock L1040–1044

### Step 6 · Web 同步（1 PR）
- [ ] `app/rehearsal/page.tsx` 三屏 parity
- [ ] `HiFiMainShell.showBottomNav`

### Step 7 · 手账闭环（1 PR）
- [ ] 预演 turn → enriched candidate 验收脚本
- [ ] 24h 内 voice 条目进 Weekly（gate 通过）

### Step 8 · 验收
- [ ] 有 digest 租户：场景 lede 非空
- [ ] 无 digest：不展示假「提过 N 次」
- [ ] 真机 iPhone 13：safe-area + 键盘

---

## 六、运维命令

```bash
# 全量刷新（purge→backfill→weekly）
AUTH_TOKEN=... npx tsx scripts/backfill-handbook-pages.mjs <familyId> <childId> --full

# 摸底
DATABASE_URL=... npx tsx scripts/diag-handbook-admission.mjs <familyId> <childId>
```

---

## 七、待用户确认

1. 详情 IA：01 理由 / 02 原文 — 是否最终形态？  
2. Weekly Top3：可读性 vs 类型多样 — 冲突优先级？  
3. 预演第 4、5 场景：固定 seed 还是仅动态？  
4. purge 后列表变短 — 是否接受？
