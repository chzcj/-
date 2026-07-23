# 育见 · 稀疏数据 + 木桶效应 + 自生成 Agent 工程方案

> Trae 2026-07-22 产出。针对用户指出的三个巨大问题，给出工程落地方案。
> 本文档是 [gnn-family-reasoning-theory.md](file:///Users/mac/Desktop/育见-2/.trae/documents/gnn-family-reasoning-theory.md) 的工程修正——理论奠基讲清了"为什么"，本文讲"在稀疏数据下怎么落地"。

---

## Part 0 · 三个问题的本质

| 问题 | 本质 | 对前几份文档的修正 |
|---|---|---|
| **1. 数据永远稀疏** | 每个家庭的数据都是零散的、少量的，数据库现有信息也不能作为支撑依据 | 推翻 gnn-theory Part 9 阶段 3"数据成熟后训 GNN"——数据可能永远不成熟 |
| **2. 木桶效应** | 系统控制论：整体效果取决于最短板，理论再宏大工程落地不了就是空谈 | 从"理论完备性"转向"工程最短板优先" |
| **3. 自生成 Agent + harness + 厚 SP** | 依据家庭信息自我生成 persona；harness 约束防偷懒；厚 SP 靠 prompt cache 撑 | 从"通用 Agent + 薄 SP"转向"个性化 persona + 统一 harness + 厚 SP" |

**核心转变**：从"建复杂图模型等数据成熟"转向"用厚 SP + harness 让 LLM 在稀疏数据下也守纪律、能诚实产出"。

---

## Part 1 · 稀疏数据下的关系推理：贝叶斯先验 + 认识论诚实

### 1.1 接受现实：数据永远稀疏

用户原话："我们所获取到的家长的数据，在未来的大量时间内都会是一些比较散乱的、零散的数据来源……必然不会是非常大量的，哪怕是针对每个家庭都是如此。"

这意味着：
- **不能**设计"等数据够了再说"的方案
- **不能**依赖大规模标注训练 GNN
- **必须**在 3-5 条原话时就产出有价值的、诚实的画像
- **必须**在 50 条原话时比 5 条时更好（增量价值），而不是"不到 1000 条没用"

### 1.2 贝叶斯先验：用理论卡当先验，少量证据做似然

稀疏数据下，贝叶斯推理是正解——先验来自领域知识（THEORY_CARDS），少量证据做似然更新：

```
后验 ∝ 先验 × 似然

先验（来自 THEORY_CARDS + 发展心理学常识）：
  "孩子拖延"在"家长焦虑督促"情境下，是"保护控制"的概率 0.4，是"焦虑回避"的概率 0.3，是"任务难度超限"的概率 0.3

似然（来自本家庭少量证据）：
  家长说"他一到作业就磨蹭" → 支持"保护控制"或"焦虑回避"
  家长说"数学特别慢" → 支持"任务难度超限"
  孩子说"我不会" → 支持"任务难度超限"

后验：
  保护控制 0.30 / 焦虑回避 0.25 / 任务难度超限 0.45
```

**关键**：即使只有 3 条证据，也能产出"带概率的多假设"——不是"等数据够了再判断"，而是"现在就判断，但标明把握度"。

### 1.3 domain-selected aggregation：稀疏数据下过滤噪声

Few-shot KG completion 研究（Nature 2026, MLGD）的核心洞察：稀疏数据下，邻居里**无关实体多**，直接聚合会引入噪声。解法是 domain-selected aggregation——动态过滤无关邻居。

**映射到育见**：检索回来的 15 条 supportingEvidence 里，可能只有 3 条和"作业拖延"真正相关。当前 router 把它们混在一起塞给 SP（[router.ts:140-158](file:///Users/mac/Desktop/育见-2/src/lib/server/memory/retrieval/router.ts#L140-L158)）。稀疏数据下这个噪声比更致命——5 条相关证据被 10 条无关稀释，LLM 更容易套模板。

**解法**：retrieval 加 relevance gate——按 query 域过滤，只留高相关的，宁可少不要杂。

### 1.4 认识论诚实 > 推理能力（稀疏数据的第一原则）

稀疏数据下，**区分"已知/推测/未知"比"多产出推断"更重要**。

- 3 条证据 → 只能下 1 个低置信假设 + 2 个待验证方向，**诚实标注"信息不足"**
- 10 条证据 → 可以下 2 个中置信假设 + 1 个待验证
- 50 条证据 → 可以下 1 个高置信工作假设 + 反证检查

**硬规则**：数据不够时，输出"目前信息不足，暂不做强结论"，而不是硬猜。这比"硬猜但错了"好得多——前者建立信任，后者破坏信任。

### 1.5 增量更新，不等批量

每条新证据都做一次小贝叶斯更新，而不是等 10 轮批量。这和 product-memory-architecture 的"写入批量"不矛盾——**写入可以批量（省成本），但假设池更新可以增量（每条新 atom 入库时小更新 posterior）**。

---

## Part 2 · 木桶效应：识别工程最短板

### 2.1 系统控制论：整体效果 = min(各环节)

用户原话："就像系统控制论里说的一样，取决于各个部分的最低值。所以你要是在工程细节上无法实现落地的话，那么这个理论就算再宏大也实现不了。"

### 2.2 业界实证：Agent 失败主因不是推理

Harness-Bench（5194 条轨迹）统计的失败模式：

| 失败模式 | 占比 | 育见对应 |
|---|---|---|
| contract/format violations | 36.4% | JSON 格式错、字段缺失 |
| tool error no recovery | 24.6% | LLM 调用失败无回退 |
| evidence not tied to claims | 14.6% | **事实锚定缺失**——判断不绑证据 |
| reasoning never committed | 11.1% | 中间步骤没持久化 |

**关键洞察**：88% 的失败是 bookkeeping 问题，不是推理问题。模型知道答案，但没写下来、没绑证据、没存中间步骤。

### 2.3 育见的工程最短板排序

结合代码实证 + 业界统计，育见的效果瓶颈（从最短到最长）：

| 排名 | 短板 | 影响 | 修复难度 |
|---|---|---|---|
| **最短 1** | **SP 偷懒无 gate** | LLM 稀疏证据下套模板、泛泛而谈、不引用证据；无产出后校验 | 中（加 harness gate） |
| **最短 2** | **认识论不隔离** | inferred 当 observed 传播，3 轮后推断变诊断 | 中（atom 加 epistemic_status） |
| **最短 3** | **atom 字段丢失** | evidenceTier/factRole 抽取时有、写库时丢；推理素材就缺 | 低（补持久化） |
| **最短 4** | **evidence not tied to claims** | 判断不绑证据 id，无法回溯"依据哪条原话" | 中（EvidenceRef id 化） |
| 5 | cache 没接线 | 每轮重算 retrievalPack，成本高 | 中（session cache + 漂移检测） |
| 6 | episode_ingest 每轮深拆 | 成本高，稀疏数据下更浪费 | 中（改批量） |

**优先级**：先补 1-4（效果瓶颈），5-6 是成本优化可后做。**不先补 1-4，任何理论都是空中楼阁。**

### 2.4 最短 1 的具体表现（SP 偷懒）

代码实证：现有 SP 虽然已有硬规则（parentFacingStyle 241 行 ~60% 硬规则，portraitSynthesizer 221 行 ~80% 硬规则），但**缺产出后校验**——LLM 产出后没有确定性代码检查"是否引用了证据、是否列了替代解释、是否标了把握度"。LLM 在稀疏证据下更容易：
- 套模板（"拖延=保护控制"复读）
- 泛泛而谈（不引用具体原话）
- 单一归因（不列替代解释）
- 虚高置信（数据不够也下强结论）

**这就是最短板**——理论讲得再好（GNN/贝叶斯/异构图），LLM 产出时偷懒，前台拿到的还是套模板的废话。

---

## Part 3 · 自生成 Agent + harness + 厚 SP

### 3.1 自生成 Agent：家庭个性化 persona

**不是让 Agent 自己改推理逻辑**（那会失控），而是**依据家庭信息生成 persona（视角配置）**：

```typescript
type FamilyAgentPersona = {
  familyId: string
  // 基于四模块 + 日常原话生成的视角配置
  parentTraits: {
    anxietyLevel: number          // 0-1，影响 Agent 关注焦虑信号的敏感度
    controlTendency: number       // 0-1，影响 Agent 对控制循环的警觉
    reflectivity: number          // 0-1，影响 Agent 提问的深度
  }
  childTraits: {
    ageStage: string              // 影响发展视角的焦点
    temperament: string           // 影响行为解读的基线
  }
  familyClimate: {
    conflictFrequency: number     // 影响对冲突信号的权重
    supportLevel: number          // 影响对保护因素的识别
  }
  // Agent 的语言温度（基于家长 reflectivity）
  toneCalibration: 'gentle' | 'direct' | 'analytical'
  // Agent 的提问策略（基于 parentTraits）
  questionStrategy: 'probe_feeling' | 'probe_behavior' | 'probe_context'
  updatedAt: string
  version: number
}
```

**生成时机**：
- 四模块建档完成时生成 v1 persona
- 每 10 轮有效交流 + deep_mechanism_review 后增量更新
- persona 持久化到 `family_agent_persona` 层（memory_layer_items 新增 layer_name）

**persona 影响**：
- 注入 SP 的 user payload（不是 system，避免破坏 cache）作为"本家庭视角配置"
- 影响 Agent 的关注点敏感度、语言温度、提问策略
- **不影响**推理逻辑和硬规则——那些由 harness 统一约束

### 3.2 harness：确定性代码约束 LLM 不偷懒

借鉴 Self-Harness（arXiv 2606）+ Harness-Bench 的 execution alignment 概念：

**harness 三层结构**：

```
[pre-gate] 调用 LLM 前
  - 注入硬约束清单（必须引用 ≥2 条本家庭 atom、必须列 ≥1 替代解释、必须标把握度）
  - 注入本家庭 persona（视角配置）
  - 注入认识论状态约束（observed/reported/inferred 不得混用）

[LLM 调用] 厚 SP + 厚 payload
  - system = 厚 SP（cache 命中，500-800 行几乎免费）
  - user = task + retrievalPack + persona + harness 约束清单

[post-gate] LLM 产出后（确定性代码，不是 LLM）
  - 校验 1：引用率——回答里是否引用了 ≥2 条本家庭 atom？没有 → 重产或降级
  - 校验 2：替代解释——是否列了 ≥1 个替代解释？没有 → 重产
  - 校验 3：把握度——是否标了把握度？数据不够时是否说了"信息不足"？没有 → 重产
  - 校验 4：禁用词——是否用了"你是…型家长""根本原因就是"？有 → 重产
  - 校验 5：套模板——连续 3 轮同一 mechanism 句式？是 → 强制换视角重产
  - 校验失败 → 重产（最多 2 次）→ 仍失败 → 降级为"诚实承认信息不足"
```

**harness 是确定性代码**（TypeScript 函数），不是 LLM。这解决"LLM 偷懒"——即使 SP 写了硬规则，LLM 也可能不守；post-gate 用代码校验，不守就打回。

**execution alignment**（Harness-Bench 核心概念）：保持四者对齐——
- Agent 推理了什么 ↔ 工作区记录了什么 ↔ 工具返回了什么 ↔ 评估检查了什么

育见的"工作区记录"= atom/evidence/dossier 持久化；"评估检查"= post-gate 校验。三者脱节就是 bookkeeping 失败。

### 3.3 厚 SP：cache 支撑下的 500-800 行

代码实证：现有 cache 架构已就绪（稳定 system + 动态 user + DeepSeek 自动前缀缓存），加厚到 500-800 行完全可行——cache 命中后 16000 tokens 的 system 成本仅 ~1600 tokens。

**加厚内容**（不是堆字数，是补 harness 段）：

#### parentFacingStyle.md（241→500+）

现有已有的（保留）：
- §一身份、§三通读义务、§五追问规则、§九字数硬性、§十一禁止清单、§十六/十七自检

新增 harness 段：
- **§十八 事实锚定决策树**：什么情况下必须引用 atom、引用几条、引用什么类型
- **§十九 替代解释硬规则**：何时必须列替代解释、列几条、如何呈现
- **§二十 把握度标尺**：3 条证据标什么、10 条标什么、50 条标什么
- **§二十一 edge case 处理**：pack 空时怎么办、pack 极厚时怎么办、证据冲突时怎么办
- **§二十二 反套模板规则**：连续 N 轮同一 mechanism 时强制换视角
- **§二十三 非归罪语言校准 scale**：从"你是…型"到"在这些情境中"的改写规范

#### portraitSynthesizer.md（221→500+）

现有已有的（保留）：
- 证据分层硬规则、交织纪律、20 条硬规则、七段规范、来源标签映射、反模式

新增 harness 段：
- **认识论隔离段**：observed/reported/derived/inferred 的传播权限；hypothesized 不得升级为 observed
- **φ_r 消息函数段**：不同关系类型用不同消息函数；五个"不能线性相加"
- **贝叶斯更新段**：先验来自 THEORY_CARDS；少量证据做似然更新；数据不够时降 confidence 而非硬猜
- **防塌缩段**：多视角头 focalDimension 正交；产出后相似度检查
- **稀疏数据诚实段**：3 条证据时 dossier 该长什么样（少而诚实）vs 50 条时（丰富）
- **worked example 补充**：2-3 户不同数据量的家庭样例

#### secondMeCollaboratorIdentity §A+§C（70→200+）

- §A 加：宏观地图使用指南、重构四层操作规范
- §C 加：判断定位决策树、机制链操作铁律细化

### 3.4 persona + harness + 厚 SP 的协作

```
每轮对话：
  1. 读 family_agent_persona（持久化的家庭视角配置）
  2. pre-gate：注入 persona + harness 约束清单 + retrievalPack
  3. LLM 调用：system = 厚 SP（cache 命中）+ user = payload
  4. post-gate：确定性代码校验产出（引用率/替代解释/把握度/禁用词/套模板）
  5. 校验通过 → 输出；校验失败 → 重产或降级

每 10 轮 + deep_mechanism_review：
  6. 更新 family_agent_persona（增量，不重来）
  7. 更新假设池（贝叶斯增量更新）
```

**关键**：persona 个性化视角，harness 统一纪律，厚 SP 提供丰富规则——三者分工，不互相替代。

---

## Part 4 · 落地优先级（木桶效应驱动）

### 4.1 第一优先：补最短板（1-2 周）

| 任务 | 对应短板 | 预期效果 |
|---|---|---|
| **post-gate harness 校验** | 最短 1（SP 偷懒） | LLM 产出被确定性代码约束，不偷懒 |
| **atom 加 epistemic_status + 持久化 evidenceTier/factRole** | 最短 3（字段丢失） | 推理素材完整，认识论可隔离 |
| **EvidenceRef id 化** | 最短 4（evidence not tied） | 判断可回溯到原话 |
| **认识论隔离规则** | 最短 2（不隔离） | 推断不当事实传播 |

**这四个是效果瓶颈**——不补，理论再好前台也是套模板废话。

### 4.2 第二优先：稀疏数据适配（1-2 周）

| 任务 | 效果 |
|---|---|
| 贝叶斯假设池（先验来自 THEORY_CARDS） | 3 条证据也能产出诚实假设 |
| domain-selected aggregation（retrieval relevance gate） | 稀疏数据下过滤噪声 |
| 把握度标尺（3/10/50 条证据的置信映射） | 数据不够时诚实标注 |

### 4.3 第三优先：厚 SP + persona（2-3 周）

| 任务 | 效果 |
|---|---|
| parentFacingStyle 加厚到 500+（补 harness 段） | 前台规则更厚，cache 几乎免费 |
| portraitSynthesizer 加厚到 500+（补认识论/贝叶斯/防塌缩） | 后台规则更厚 |
| family_agent_persona 层 + 生成/更新 | 家庭个性化视角 |

### 4.4 第四优先：成本优化（1 周）

| 任务 | 效果 |
|---|---|
| session cache 接线 + 漂移检测 | 省每轮重算成本 |
| episode_ingest 改批量 | 省 LLM 调用次数 |

### 4.5 和既有文档的执行顺序

```
product-memory-architecture Layer 0（工程 P0：开 PORTRAIT_V3 + 修 6 断点）
  ↓
本文 Part 4.1（补最短板：post-gate + epistemic_status + EvidenceRef + 认识论隔离）
  ↓
本文 Part 4.2（稀疏数据适配：贝叶斯 + relevance gate + 把握度标尺）
  ↓
product-memory-architecture Layer 1-2（写入批量 + 读取双引擎）
  ↓
本文 Part 4.3（厚 SP + persona）
  ↓
deep-portrait-v4（多头 + 三角验证 + 假设池）
  ↓
本文 Part 4.4（成本优化）
```

**关键调整**：post-gate harness 校验和 atom 字段补全，**提前到 Layer 0 之后立刻做**——因为它们是效果瓶颈，不补的话 Layer 1-2 做了也白做（前台还是套模板）。

---

## Part 5 · 验收标准（针对三个问题）

### 5.1 稀疏数据验收

- 3 条证据的家庭，dossier 有 ≥1 个低置信假设 + ≥1 个待验证方向 + 明确标注"信息不足"
- 50 条证据的家庭，dossier 有 ≥2 个中高置信假设 + ≥1 个反证检查
- 不出现"数据不够但下了强结论"的情况

### 5.2 木桶效应验收

- post-gate 校验通过率 ≥ 90%（LLM 产出一次过）
- 校验失败的 10% 中，重产后通过率 ≥ 80%
- 前台回答 atom 引用率 ≥ 80%
- 连续 3 轮同一 mechanism 句式 → 判 fail 并重产

### 5.3 自生成 Agent 验收

- family_agent_persona 层有数据
- persona 随家庭信息累积而更新（version 递增）
- 不同家庭的 persona 有差异（不是全一样）
- persona 影响 Agent 关注点（A 家庭焦虑高 → Agent 更敏感于焦虑信号）

---

## Part 6 · 给执行者的分工

| 任务 | 适合谁 | 理由 |
|---|---|---|
| post-gate harness 校验代码 | Cursor | 确定性 TypeScript 函数，改动明确 |
| atom 加 epistemic_status + 持久化 | Cursor | db.ts + pipeline.ts 字段补全 |
| EvidenceRef id 化 | Trae | 涉及全链路类型改造 |
| 认识论隔离规则 | Trae | SP 改写 + 代码校验 |
| 贝叶斯假设池 | Trae | 数学逻辑 + SP |
| 厚 SP 加 harness 段 | Trae | SP 是 Trae 主场 |
| family_agent_persona | Trae | 新层设计 + 生成/更新逻辑 |
| session cache 接线 | Cursor | 代码接线，逻辑明确 |

---

## Part 7 · 诚实总结

用户三个问题的核心修正：

1. **稀疏数据**：推翻"等数据成熟训 GNN"的后路。用贝叶斯先验 + 认识论诚实，3 条证据也能产出有价值画像。**第一原则：区分已知/推测/未知比多产出更重要。**

2. **木桶效应**：最短板是"SP 偷懒无 gate"和"认识论不隔离"，不是理论不够宏大。**先补 post-gate harness 校验 + atom 字段 + 认识论隔离，再做任何花哨的图模型。**

3. **自生成 Agent + harness + 厚 SP**：persona 个性化视角（依据家庭信息），harness 统一纪律（确定性代码约束），厚 SP 提供丰富规则（cache 几乎免费）。**三者分工：persona 管视角，harness 管纪律，厚 SP 管规则深度。**

一句话：**在稀疏数据下，让 LLM 守纪律、诚实标注把握度，比建复杂图模型更重要。** 理论奠基（gnn-theory）定义了"理想长什么样"，本文定义了"在现实约束下怎么落地"。
