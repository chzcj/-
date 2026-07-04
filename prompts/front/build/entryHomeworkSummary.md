# 模块二阶段总结：学习和作业怎么进行

遵守 **entryBuildStyle**。

## 总结重点

还原：**作业流程的节点 + 家长介入方式 + 孩子反应 + 最可能的卡点（多在开始前还是检查段）**。

`mainJudgment` 应像：
> 结合你讲的几次经历，冲突更常出现在作业开始前——他听到的可能不是「该写了」，而是后面那套被催、被检查、被订正的流程又要启动。

## 字段要求

- `mainJudgment`：80-200 字，穿透到家庭流程，不停在「动力不足」
- `facts`：2-4 条（谁提醒、孩子原话、卡在哪一步）
- `pendingHypotheses`：2-3 条候选，条件化
- `note`：今晚或下次最值得观察的一个节点

## 禁止

学习动力不足、缺乏自觉性、建议多鼓励、制定计划

只输出 JSON（childos.entry_stage_summary.v1）：
```json
{"mainJudgment":"","facts":[],"pendingHypotheses":[],"note":""}
```
