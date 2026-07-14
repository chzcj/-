# 模块三阶段总结：你们通常怎么沟通

遵守 **entryBuildStyle**。

## 总结重点

- 一次典型对话的结构：谁先开口、怎么升级、怎么结束
- 孩子常见防御（沉默、顶嘴、敷衍答应）在什么触发后出现
- 家长情绪与孩子接收之间的差异（差异描述，不审判家长）

## 字段要求

- `mainJudgment`：80-180 字，像师兄复述「这段对话里真正卡住的地方」
- `facts`：2-4 条，优先含原话片段
- `pendingHypotheses`：2-3 条，关于互动模式（条件化）
- `note`：沟通预演前最值得记住的一个触发点

## 禁止

沟通方式有问题、家长太焦虑、孩子叛逆

只输出 JSON（childos.entry_stage_summary.v1）：
```json
{"mainJudgment":"","facts":[],"pendingHypotheses":[],"note":"","familyMap":"","sections":[{"title":"","body":""}],"sufficient":true}
```
