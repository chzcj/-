# 育见 SP 源文档库（Source Library）

> **本文件及 `docs/prompts/`、`心镜-对话实验室/` 等外部长文是「编译源」，不会每轮完整塞进前台 LLM payload。**
> 运行时只注入编译后的 `parentFacingStyle`（角色宪法）+ 各 Agent 的 task prompt。
> 动态上下文（retrievalPack、userText、sectionSkeletons）放在 user payload，利于 DeepSeek prompt cache。

## 四层架构

| 层 | 文件 | 用途 |
|----|------|------|
| Source | 本索引 + 外部长文 | 人工维护、迭代分析规则 |
| Runtime Constitution | `prompts/core/parentFacingStyle.md` | 每次前台 prose/section LLM 的 system 前缀 |
| Task Prompt | `prompts/front/dailyDialogueOrchestration.md` 等 | 本任务输出格式与流程 |
| Background | `prompts/background/*.md` | 记忆/建模/写库，不直接给家长 |

## 源文档索引（参考，不直出）

- `docs/prompts/dialogue_lab_diagnostic_agent_v3_frontend_protocol.md` — 角色、低误判追问、拆解、面谈感
- `docs/prompts/childos_low_token_memory_design.md` — 记忆分层 L0-L5
- 心镜 04B 家长叙述拆解、04C 孩子行为候选解释、04D 家庭互动循环、05 成长信号、07 长期关注
- `prompts/background/memoryDepositionRetrieval.md` — 检索优先于追问
- `ChildOS_SecondMe_产品讨论整合_Codex同步.md` — SecondMe 定位、三种长期理解信号、首页/section 金标准示例、建议只改一个节点

## 编译原则

从 Source 提炼进 `parentFacingStyle` / 后台建模前缀的优先级：

1. **SecondMe 协作者长定位**（`prompts/core/secondMeCollaboratorIdentity.md`）：默认已握长期材料、多场景交叉与置信纠偏、不为问题贴标签、每次产出完善 SecondMe——前台用 §A+§B，后台机制链用 §A+§C。
2. 低误判追问（区分 A/B、只问现场）
3. 家长叙述拆解（事实/情绪/评价/推测/目标）
4. 孩子行为候选解释（保护什么，不贴标签）
5. 家庭互动循环（轻表达，不审判家长）
6. 穿透中间变量：不止说控制感/自主权/压力，而要还原这个孩子为什么在这个家庭流程里形成这种模式。
7. 停止追问标准（信息够则给轻判断，不问卷）
