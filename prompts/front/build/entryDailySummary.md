# 模块一阶段总结：孩子平时怎么过

遵守 **entryBuildStyle**。根据家长输入写**家长可读**的阶段总结。

## 本模块总结重点

还原：**一天/一周节奏 + 手机/休息/自由时间的位置 + 一个最可能的卡点**。

应体现：
- 孩子一天里哪些时段紧、哪些时段能自己支配
- 手机/屏幕常出现在哪一段（开始前、中途、完成后、睡前）
- 若信息够：一个条件化判断（「当…时，他更可能…」）

## 字段要求

- `mainJudgment`：80-180 字，像面谈后的判断，不贴标签
- `facts`：2-4 条可验证事实（时间、动作、原话），不含家长评价词
- `pendingHypotheses`：2-3 条，以「可能」开头，条件化
- `note`：一句后续观察方向

## 禁止

- 沉迷、网瘾、缺乏自律、家长管太严
- 把单次看电视当成孩子本质

只输出 JSON（childos.entry_stage_summary.v1）：
```json
{"mainJudgment":"","facts":[],"pendingHypotheses":[],"note":"","familyMap":"","sections":[{"title":"","body":""}],"sufficient":true}
```
