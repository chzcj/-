# 育见【深度建模】产品宪法

> 本文件是判断所有功能取舍的统一约束源。  
> **全景对照表**：[`PRODUCT.md`](../../PRODUCT.md)（功能 × 记忆 × Agent）· [`DESIGN.md`](../../DESIGN.md)（组件 × 记忆来源）  
> 代码契约：`docs/contracts/read-contract.md`；后台理论：`prompts/background/deepMechanismReview.md`。

## 1. 我们在卖什么

**培优型家庭理解系统**：帮助已经努力、想真正理解孩子的家长，把真实生活片段沉淀为越来越准的孩子 SecondMe，并给出可验证、可行动的成长支持——不是拯救危机家庭，不是育儿百科，不是流水账。

## 2. 深度建模定义

基于家长输入的**具体事实与原话**、四模块证据、日常交流、多 Agent 工作流，构建可解释：

- **证据分层 + 整合底稿**（Family Understanding Dossier，schema v2，理论隐身）
- 家庭结构与支持分工（familyStruct / fivePs）
- 场景化理解（sceneReadings）与可证伪 workingHypothesis
- 干预靶点（interventionTargets）与增量更新（L1 patch / L2 重概念化）
- 孩子行为的功能性解释（protective，交织非贴卡）
- 家长叙事模式与沟通偏好
- 待验证假设与培优向成长重点

家长可见输出必须**引用底稿切片 dossierSlice 或 digest 投影**，形成有广度、可验证的叙述；`matchedMechanisms` 仅作兜底。

## 3. 两个核心记忆原则

1. **家长输入是原材料**：事实、原话、场景越具体，AI 越能深度理解；不嫌弃信息质量，具体事实都要存、都要分析。
2. **多 Agent 联合建模**：采集 Agent、证据拆解、综合建模、深度机制复核、画像刷新、日常前台——分工协作，共享 `deepModelDigest` 家长向摘要层。

## 4. 多 Agent 分工

| Agent | 时机 | 读什么 | 写什么 |
|-------|------|--------|--------|
| 四模块采集 | 首次建模 | 模块 SP + 家长输入 | entry_records、stage summary |
| entry_evidence | 每模块完成 | rawText | 结构化事实包 |
| profileBuildSynthesis | 四模块齐 | 四份 stage summary | 证据网络草案 |
| profileBuildDiagnosis | 综合后 | synthesis 交接 | coreJudgment、机制链草案 |
| deep_mechanism_review | 建模完成 + 日桶 | 全量记忆层 | 覆盖机制矩阵、假设、家长叙事 |
| deepModelDigestBuilder | deep 完成后 + 日刷新 | 机制+画像+循环+假设 | `deep_model_digest` 家长向摘要 |
| dailyPortraitRefresh | 进 daily/profile | digest + 近期输入 | portraitCards、thinkingChips |
| 日常前台 Agent | 每轮交流 | digest + retrievalPack | prose + sections |

## 5. 家长可见 / 不可见边界

**可见（人话）**：条件化判断、互动循环描述、锚定事实与原话引用、待验证点、培优向「今晚可试」、清北学霸家庭智慧背书（气质，非诊断标签）。

**不可见**：16 理论卡名称、机制矩阵 JSON、置信度分数、心理诊断标签、创伤推断、家长道德评判。

## 6. 输入标准

- 四模块：鼓励每模块 **≥800 字**（软引导，面谈式追问，非问卷硬阻断）
- 日常：短输入友好，但 ≥80 字优先写入 episode
- 原话：家长与孩子原话片段必须存入记忆并在 digest 中可召回

## 7. 前台 SP 强制门控

所有家长可见 AI 输出必须：

1. 先读 `deepModelDigest` + `dossierSlice`（无则读 retrievalPack 并明示信息不足）
2. 至少引用 **1 条** anchoredFacts 或 entryFacts
3. 至少 **1 句** 整合理解（workingHypothesis / integratedSynthesis，非离散机制贴卡）
4. **培优语气**：成长加速器，非危机拯救
5. 禁止停在中间变量（拖延、内驱力、压力）收尾；禁止理论名泄漏

## 8. 底稿更新机制（v3）

- **Level 1**：memory_write 链尾 `dossier_patch` — 新事实增量，workingHypothesis 核心不变
- **Level 2**：`deep_mechanism_review` 入口 `shouldReconceptualize` — 反证/干预无效/指纹变化 → portraitSynthesizer 全量重跑
- **Feature flag**：`PORTRAIT_V3=0`（默认）走旧 mechanism 矩阵；`=1` 启用 dossier 主路径

## 9. 产品最怕变成

流水账、鸡汤、育儿百科、空泛 AI、炫技但无用、心理测评、假数据填充。
