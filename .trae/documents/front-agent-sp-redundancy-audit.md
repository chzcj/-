# 前台 SP 全链路冗余检测报告

> 状态：只读检测，不改代码。基于全链路探测 + 本次精读 section-composer.ts / prose-section-stream.ts / parentFacingCopy.md / parentFacingStyle.md / dailyDialogueOrchestration.md。
> 目的：找前台 Agent 从写入到调 LLM 的冗余/不一致/可优化点，让每步更坚实。

---

## 检测范围（前台表达层 5 文件）

| 文件 | 作用 | 行数 |
|------|------|------|
| [section-composer.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/section-composer.ts) | 纯规则产出 section 骨架（id/label/kind/hidden） | 122 |
| [prose-section-stream.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/prose-section-stream.ts) | 合并 prose+visible section 一次 LLM 流式调用 | 158 |
| [parent-facing-copy.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts) | hidden section 二次 LLM 调用（Fast JSON） | ~100 |
| [parentFacingCopy.md](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) | Section 文案 Agent SP | 109 |
| [parentFacingStyle.md](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) + [dailyDialogueOrchestration.md](file:///Users/mac/Desktop/育见-2/prompts/front/dailyDialogueOrchestration.md) | 前台宪法 + 日常对话编排 | 187+145 |

---

## 检测结论：5 个冗余/不一致点

### R1 · system prompt 三处拼接，parentFacingStyle 重复注入（中度冗余）

**证据**：
- 主调用 [prose-section-stream.ts:29](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/prose-section-stream.ts) `combinedProseAndSectionSystem()` = `parentFacingStyle + deepModelingParentDigest + dailyDialogueOrchestration + parentFacingCopy`
- hidden 调用 [parent-facing-copy.ts:41](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts) `sectionCopySystem()` = `parentFacingStyle + deepModelingParentDigest + parentFacingCopy`
- safety 调用 `combinedProseSystem()` = `parentFacingStyle + dailyDialogueOrchestration`

**问题**：parentFacingStyle（187 行）+ deepModelingParentDigest 在主调用与 hidden 调用都注入，**两次 LLM 调用重复读 ~250 行 system**。虽 prompt cache 能命中前缀，但 hidden 调用的 user payload 也带 retrievalPack（[parent-facing-copy.ts payload](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/parent-facing-copy.ts)），**与主调用 payload 高度重叠**。

**优化建议**：
- hidden section 预取时，payload 只带 `dossierSlice` + 该 hidden section 的 skeleton + 简短上下文，**不带完整 retrievalPack**（主调用已写过 prose，hidden 只需补 section）。预估省 30-40% hidden 调用 input token。
- dossierv3 落地后，hidden payload 改用 `sliceForRehearsal/Profile` 切片，不喂全包。

### R2 · section-composer 仍理论卡硬挂（与 dossier v3 冲突）（重度）

**证据**：[section-composer.ts:3-16](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/section-composer.ts) 顶部硬编码 `THEORY_SOURCES` 映射（attachment/self_determination/.../parenting_style 等 10 个理论源）；[section-composer.ts:50-60](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/section-composer.ts) `composeHighConfidenceSkeleton` 里：
```
const theory = THEORY_CARDS.find((card) => matched.some((item) => item.includes(card.name)))
if (theory) { sections.push({ id: 'professional_perspective', note: `相关理论：${theory.name}（${THEORY_SOURCES[theory.id]}）...` }) }
```

**问题**：
- 这与 dossier v3「理论隐身」**直接冲突**——`professional_perspective` section 的 note 里直接出现"Bowlby / Ainsworth 依恋研究""Patterson 强制循环理论"等理论名，家长可见。
- 依赖 `matchedMechanisms` 字符串匹配 `card.name`，dossier v3 把 matchedMechanisms 降级兜底后，这个 section 可能不再触发，但代码仍在。
- `THEORY_SOURCES` 映射与 `theory-cards.ts` 是**双源**，理论卡改名时这里不会同步。

**优化建议**：
- dossier v3 落地时，**删除 `professional_perspective` section 与 `THEORY_SOURCES` 映射**。理论视角已进 `ecologicalCalibration`（内部），不应再以前台 section 形式出现。
- 或改 note 为人话："这是一种理解这次互动的视角，不是诊断"，不带理论名。
- Task: 加 spec REMOVED Requirement「professional_perspective section 与 THEORY_SOURCES 硬挂」。

### R3 · parentFacingCopy.md §气质参照 与 dossier v3 术语禁令冲突（中度）

**证据**：[parentFacingCopy.md:85](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) 气质参照例句"你家孩子属于『下注前先害怕』这一类"+ [parentFacingCopy.md:87](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) "概括句优先取材 deepModelDigest.mechanismNarrative / retrievalPack.childStructureModels"

**问题**：
- dossier v3 把 `mechanismNarrative` 改为 `integratedSynthesis`，但 parentFacingCopy.md §气质参照仍写"取材 mechanismNarrative"——**字段名漂移**。
- §气质参照的"属于…这一类"判断句式，与 dossier v3「不许贴标签、用交织叙事」有张力——前台仍被训练成给"类型判断"。

**优化建议**：
- parentFacingCopy.md §气质参照 + §果断与念读 的字段引用从 `mechanismNarrative` → `dossierSlice.workingHypothesis / integratedSynthesis`。
- 「属于…这一类」句式改为"在…场景里他更容易…"（条件化，非贴标签），对齐 dossier v3 sceneReadings。
- Task: 已在 spec Task 13.1，需补 parentFacingCopy.md 同步改。

### R4 · parentFacingCopy.md §禁止词列表 与 dossier v3 减冗余后有遗留（轻度）

**证据**：[parentFacingCopy.md:97-102](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) 禁止词列表含"待验证、反证、旧判断、机制信号、证据网络、置信度、写入记忆..."

**问题**：dossier v3 砍了 `openObservations`/`predictedObstacles`/`childQuotes` 段，但禁止词列表没补 dossier v3 新禁的词（如"稳态""强制循环""homeostasis""三角化""SDT""亚系统""边界弥散"等 familyStruct/fivePs 内部段术语不应漏到前台）。

**优化建议**：parentFacingCopy.md §禁止词 补 dossier v3 术语禁令清单，与 spec「底稿 SHALL NOT 含」同步。

### R5 · prose-section-stream taskTitle 提炼与 tonightTaskGenerator 重复（轻度）

**证据**：[prose-section-stream.ts:45](file:///Users/mac/Desktop/育见-2/src/lib/server/daily/prose-section-stream.ts) 主调用末尾要求 LLM 输出 `---task---` + taskTitle；同时 [task-service.ts](file:///Users/mac/Desktop/育见-2/src/lib/server/tasks/task-service.ts) 有 `tonightTaskGenerator` Agent 单独润色 taskTitle。

**问题**：taskTitle 被提炼两次——主 LLM 调用先出粗版，tonightTaskGenerator 后台再润色。若主调用已出高质量 taskTitle，后台润色是冗余；若主调用出的差，后台润色又依赖粗版。

**优化建议**：
- dossier v3 落地后，主调用 taskTitle 改为直接取 `dossierSlice.interventionTargets[0].action`（dossier 已有结构化干预靶点），**不再让主 LLM 现编**。
- tonightTaskGenerator 改为"从 interventionTargets 选最贴合本轮的 + 润色"，而非从 prose 现提炼。
- 省主调用 taskTitle token + 提升任务质量（dossier 靶点比 LLM 现编更准）。

---

## 优化建议汇总（入 spec/tasks）

| 编号 | 问题 | 优化 | 入 spec 位置 |
|------|------|------|-------------|
| R1 | hidden payload 带全包 | hidden 只带 dossierSlice+skeleton | Task 13 新增 SubTask |
| R2 | professional_perspective 理论硬挂 | 删 section + THEORY_SOURCES | spec REMOVED + Task 13 |
| R3 | parentFacingCopy 字段名漂移 | mechanismNarrative→dossierSlice | Task 13 补 parentFacingCopy |
| R4 | 禁止词列表未同步 dossier v3 | 补术语禁令 | Task 13 补 |
| R5 | taskTitle 双提炼 | 主调用取 interventionTargets | Task 13 新增 SubTask |

---

## 不冗余、保留的部分（确认健康）

- section-composer 纯规则产骨架（不调 LLM）✓ 设计健康
- prose-section-stream 合并 prose+section 一次调用 ✓ 已是优化（消除 7.6s 排队）
- parentFacingStyle 六类拆解 + 低误判追问 + 概括演进 ✓ 前台宪法没问题
- fillDailySectionCopy 并行预取 hidden ✓ 不阻塞前台

**核心结论**：前台 SP 文风层面没问题（你之前判断正确），问题在①理论硬挂（R2）②字段名漂移（R3）③hidden payload 过厚（R1）④taskTitle 双提炼（R5）。dossier v3 落地时一并修。

---

## 补充诊断 · "要方法就沉默"的 SP 死板根因（用户反馈）

用户观察：家长要方法时 Agent 倾向沉默/只给解释，不给方法。细读 parentFacingStyle.md + orchestration pipeline + parentFacingCopy.md 后定位**6 个系统性根因**（不是 Agent 不会，是 SP 把"要方法"翻译成了"先解释+追问+一个小动作"）：

### S1 · §五「低误判追问」是最高优先级，压制了给方法
[parentFacingStyle.md:72-80](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) §五"宁可短、宁可问，不要硬给深度结论"。家长说"怎么办"时，Agent 第一反应是"信息够不够？不够就追问"，而不是"给方法"。这条规则设计初衷是防幻觉，但副作用是**要方法也被当成"信息不够"**。

### S2 · §九概括分级：低置信走 follow_up/light，prose 变短+追问
[parentFacingStyle.md:124-127](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) `analysis 轮（高置信）`才给概括，`follow_up/light 轮（低置信）`概括降级为"对这一幕的概括"。要方法时若 Agent 判断置信不够，就走 follow_up/light，**prose 变短+追问，方法被推到 section**。

### S3 · §六"候选解释不是标签"+"不停中间变量"强制先解释
[parentFacingStyle.md:84-91](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) Agent 被训练成"先解释为什么，再给方法"，且解释必须落到真实家庭流程。家长要方法时，Agent 先花篇幅解释"他为什么这样"，**方法被挤到 advice section**。

### S4 · orchestration 路由把"要方法"翻译成"给解释"
[orchestration/pipeline.ts:347](file:///Users/mac/Desktop/育见-2/src/lib/server/orchestration/pipeline.ts) `ask_advice && canExplain → model_based_explanation`。要方法时若能解释，路由成"基于模型的解释"——**这把"要方法"直接翻译成了"给解释"**，Agent 就去解释了。`ask_advice` 只在 `!canExplain` 时才走别的路。

### S5 · advice section 硬限"一个小动作 80-150 字"
[parentFacingCopy.md:76](file:///Users/mac/Desktop/育见-2/prompts/front/parentFacingCopy.md) advice section "只一个小动作+今晚验证什么"，80-150 字 1 段。**方法被硬限到"一个小动作"**，家长要多个方法或要详细方法时，Agent 沉默/只给一个。

### S6 · §九"深度结论放 section"把方法挤出 prose
[parentFacingStyle.md:80](file:///Users/mac/Desktop/育见-2/prompts/core/parentFacingStyle.md) "深度结论放 section，由 copy agent 写"——prose 不给方法，方法在 section。但 section 又被 S5 限"一个小动作"。**方法在 prose 与 section 双重受限**。

### 优化建议（dossier v3 解法）

dossier v3 的 `interventionTargets`（结构化干预靶点，每条带 action/prediction/obstacle）正好解这个问题——方法不再靠 Agent 现编或硬限一个，而是从 dossier 靶点取：

| 根因 | v3 解法 |
|------|---------|
| S1 追问压制给方法 | dossier v3 SP 区分"要方法"与"信息不够"：要方法时优先取 `interventionTargets`，不默认走追问；只有 `relationshipType=insufficient` 才追问 |
| S2 低置信走 light | 引入 `ask_advice` 专属 proseMode，不套 follow_up/light 的短回复模板；要方法时 prose 可直接给 1 个靶点 action |
| S3 先解释后方法 | advice section 改为"先一句为什么（引 workingHypothesis）+ 再给 interventionTarget.action + 预测 + 障碍"，解释与方法一体，不分离 |
| S4 路由翻译错 | orchestration `ask_advice && canExplain` 时，frontResponseType 从 `model_based_explanation` 改为 `advice_from_dossier`（新枚举），区分"要解释"与"要方法" |
| S5 硬限一个小动作 | advice section 字数上限放宽到 150-250 字，允许 1-2 个 interventionTargets（dossier 靶点），但每个必带 prediction+obstacle（防泛波单薄） |
| S6 prose 不给方法 | `ask_advice` 轮 prose 可含一个 interventionTarget.action 一句话（"今晚可以试：…"），不强制把方法全推 section |

**入 spec**：附录 G 新增 R6（"要方法就沉默"的 SP 死板，6 根因 + v3 解法表）。

### 健康部分（保留不改）
- §五低误判追问本身设计正确（防幻觉），只是要区分"要方法"与"信息不够"
- §六候选解释不是标签本身正确（防贴标签），只是不该在"要方法"时强制先解释
- §九概括分级本身正确（防满篇含糊），只是 `ask_advice` 不该套 follow_up/light 模板
