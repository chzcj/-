# Prose 验收说明（replay · 非手工改写）

> 2026-07-18 起：**禁止**用手工 polished draft 当 Gold After。验收走 SP + LLM 全链路 replay。

## 怎么跑

```bash
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
node --import tsx scripts/replay-daily-prose.mjs --limit=5 --family=f_demo,fam_1783439265597_luqfco
node --import tsx scripts/sample-daily-prose.mjs
node --import tsx scripts/prose-mechanism-qa-trial.mjs --family=fam_1783439265597_luqfco
```

- **Before** = 生产 `turn_events.assistantReply`
- **After** = 当前 workspace SP（含 `deepModelingParentDigest`）+ 真实 retrievalPack + digest + LLM

## 读什么

1. [prose-replay-rubric.md](./prose-replay-rubric.md) — 6 维 /18 分 + 截断率
2. 产出 `.trae/documents/prose-replay-YYYYMMDD.md`
3. 重点：**SingleFocus / PlainLanguage**、是否仍被 80 字截断

## 主轴（SP）

- 动笔前：**通读全部 pack** → 内心懂这户 → **预判家长目的** → **只答一个重点**
- 建议式结构，非 checklist 填空
- `proseMode` 为启发式字数预算（长叙述→analysis 200；短确认→light 80）
