# 育见 · GNN × 家庭关系推理理论奠基

> Trae 2026-07-22 产出。基于：GNN 深层限制文献（过平滑/过挤压）+ 异构图关系归纳偏置 + Social Relations Model / APIM + 家庭网络分析（Nature 2025）+ 现有代码结构实证。
> 本文是「理论奠基」，不写代码；先掌握原理，再谈落地。凌驾于 [deep-portrait-v4-multihead-triangulation.md](file:///Users/mac/Desktop/育见-2/.trae/documents/deep-portrait-v4-multihead-triangulation.md) 之上——那份讲"画像结构升级"，本文讲"为什么这样升级、底层原理是什么"。

---

## Part 0 · 你要的核心命题（原话提炼）

> "深度机制是由关系组成的……GNN 思维进行家庭推理，不同类型的节点和边，更丰富的关系表达，让 AI 理解关系而不是理解特征，滤波和特征提取（atom 加标注）+ 加权求和 + 调整权重参数……家庭和家长都是复杂的混合体，是多种关系的权重合并，不要简单归因。"

拆为 5 个理论命题：

| 命题 | 含义 | 本文回答 |
|---|---|---|
| **关系本位** | 机制 = 关系，不是特征 | Part 1：为什么"关系决定特征如何被理解" |
| **深度非层数** | 信息传递层数越深≠理解越深 | Part 2：GNN 过平滑/过挤压的数学限制 |
| **异构多关系** | 不同类型节点 + 不同类型边 | Part 3：异构图与关系归纳偏置 |
| **加权非堆叠** | 加权求和不是线性相加 | Part 4：消息函数 φ_r 按关系类型分叉 |
| **混合体非归因** | 家庭是多种关系权重合并 | Part 5：SRM/APIM 四分量分解 + 多机制混合 |

---

## Part 1 · 关系本位：不是"关系代替特征"，而是"关系决定特征如何被理解"

### 1.1 错误的二分法

容易把 GNN 理解成"抛弃特征，只用关系"。这是误读。Battaglia et al. (2018) *Relational inductive biases, deep learning, and graph networks* 的核心不是"关系取代特征"，而是：

> **节点和事件提供内容，关系决定内容如何解释、传播和组合。**

### 1.2 同一事实在不同关系里意义不同

以你举的"妈妈每天检查作业"为例。这句话作为**特征**是中性的；它的**机制意义**由关系决定：

| 关系情境 | 同一行为的机制意义 |
|---|---|
| 孩子主动请求帮助 + 能力暂时不足 | 支持 / 脚手架（正向） |
| 家长焦虑驱动 + 高频即时督促 + 孩子回避 | 控制循环（风险） |
| 家庭近期升学压力 + 检查后逐步放权 | 阶段性 + 促进自主（过渡） |
| 检查后不断接管 + 孩子自主感下降 | 削弱自主（风险） |

所以系统**不能**把"每天检查作业"编码成一个负向特征。它必须和以下信息**组合**才能定机制：

```
行为主体（谁）+ 行为对象（对谁）+ 发生情境（什么场景）
+ 行为频率（多久一次）+ 行为方式（怎么做的）
+ 孩子即时回应 + 家长后续回应
+ 关系历史 + 外部压力 + 时间趋势
+ 信息来源 + 证据可信度
```

这正是图结构天然擅长的事——**关系归纳偏置**（relational inductive bias）：模型通过节点、边及其组合推理，而不是把所有信息压成一张扁平表。

### 1.3 为什么扁平表不行

把"妈妈每天检查作业 + 孩子拖延 + 家长焦虑"压成一行特征 `[检查频率=高, 孩子拖延=是, 家长焦虑=中]`，丢失的是：
- 谁对谁做的（主体-客体方向）
- 在什么场景下（情境调制）
- 孩子怎么回应的（双向闭环）
- 这个循环重复了几次（时序频率）
- 信息来自谁（认识论来源）

扁平表只能学到"高检查频率 ↔ 拖延"的相关性，学不到"焦虑驱动的督促 → 孩子回避 → 督促加强"的**反馈循环**。而家庭问题的核心恰恰是循环，不是相关。

---

## Part 2 · 深度非层数：GNN 深层的两个硬限制

你说"层数越深，感受越大"——这在数学上对（感受野扩大），但"层数越深，理解越深"**不成立**。深 GNN 有两个已知限制，必须理解，否则会误把"堆 10 层"当成"深度机制"。

### 2.1 过平滑（Oversmoothing）

**现象**：GNN 每层把节点表示与邻居平均/聚合。层数增加，不同节点的表示**趋同**，丢失节点特异性。

**数学本质**（Oono & Suzuki 2019）：消息传递 GCN 的表示秩随深度指数收敛到 1——即所有节点表示坍缩到同一个方向。

**为什么 2-4 层就发生**（ICLR'23 非渐近分析）：过平滑不是"很深才出现"的现象，在浅层（2-4 层）就会发生，部分是因为深层 GNN 难以优化。

**映射到育见**：如果让"孩子拖延"这个节点的表示经过 5 跳传播，它会吸收"家长焦虑""夫妻分歧""学校压力""睡眠不足"的表示，最终所有因素节点的表示趋同——**分不清"拖延"和"焦虑"的区别**。这不是"理解更深"，是"理解糊了"。

### 2.2 过挤压（Oversquashing）

**现象**：当图有结构瓶颈（两个密集社区只由少数边连接），远端信息要穿过瓶颈时被压缩进固定维度向量，**信息丢失**。

**数学本质**：远端节点 u 对节点 v 最终表示的偏导 ‖∂h_v^(L)/∂x_u‖ ≈ 0——即远端节点的变化几乎不影响 v 的表示，即使理论上在 L 跳感受野内。

**与过平滑的区别**：
- 过平滑 = 节点表示**太像**（深度问题）
- 过挤压 = 远端信息**传不到**（结构瓶颈问题）

**映射到育见**：家庭里"夫妻关系"和"亲子关系"两个子系统，如果只通过"孩子"这一个节点连接（瓶颈），那么夫妻分歧的细节要穿过孩子节点才能影响对亲子机制的判断——细节被压扁。解决不是"加层"，是**加边**（让夫妻节点直接连到亲子机制节点）或**用事件节点/超图**表达多方共同参与。

### 2.3 噪声传播

一个低可信度推断经过多层传播后，被误当成系统性结论。这是你说"不要简单归因"的技术根因——**推断不能在下一轮当成观察再传播**，否则产生"推断自我强化"。

### 2.4 所以"深度"该是什么

真正的深度是 5 维，不是层数：

| 深度维度 | 含义 | 育见里的体现 |
|---|---|---|
| **关系深度** | 从单个行为追踪到双向关系、家庭子系统 | FamilyInteractionChain 8 字段链 |
| **时间深度** | 识别重复循环、变化趋势、阶段转折 | cycle.status（candidate→stage→stable）+ version 链 |
| **情境深度** | 区分作业/睡眠/冲突/社交等场景 | DossierSceneReading.scene + protectiveMix |
| **证据深度** | 保留来源、可信度、矛盾证据、缺失信息 | TriangulatedFact（本文档新增） |
| **机制深度** | 从现象进入反馈循环和可验证假设 | HypothesisPool + predictions |

目标不是无条件堆 10 层 GNN，而是**让每一跳都有明确的家庭语义**。

---

## Part 3 · 异构多关系：不同节点 + 不同边，不同消息函数

### 3.1 为什么同构图不够

同构图（所有节点同类型、所有边同类型）把"妈妈检查作业"和"孩子拖延"当成同类节点、把"触发"和"缓冲"当成同类边。这丢失了家庭的关系异构性。

异构图（Heterogeneous Graph）允许：
- 不同节点类型用不同特征空间（人/状态/需求/行为/信念/情境）
- 不同边类型用不同消息转换函数（"支持"≠"控制"≠"触发"）

### 3.2 关系归纳偏置（Battaglia 2018）

图网络（GN）框架的三个更新函数：
- 节点更新 `v_i' = φ_v(v_i, Σ edges, Σ neighbors)`
- 边更新 `e_k' = φ_e(e_k, v_sender, v_receiver, global)`
- 全局更新 `u' = φ_u(Σ nodes, Σ edges)`

关键：**每个 φ 可以按关系类型分叉**。"支持"的 φ_e 和"控制"的 φ_e 是不同的函数，不是同一个权重的不同值。

### 3.3 RHGNN 的启示（Zhu et al. 2025）

RHGNN 用 Type2vec 给边类型学 embedding，把异构图当整体建模（不靠 meta-path 拆分），并对同类型边施加平滑正则（关系归纳偏置）。

**映射到育见**：不要给每种关系写一个独立的检索/推理管线（meta-path 思路，重且难维护），而是**统一一张异构图 + 按边类型分叉的消息函数**。

### 3.4 育见的节点类型与边类型（基于代码实证 + 用户资料）

**节点类型**（12 类）：

| 节点 | 现有对应 | 示例 |
|---|---|---|
| Person | （隐含，未显式建模） | 孩子/父亲/母亲/祖辈/老师 |
| State | DossierFactor（部分） | 焦虑/疲惫/安全感/胜任感 |
| Need | （无） | 自主/连接/边界/休息/支持 |
| Behavior | Atom（content 里隐含） | 督促/回避/表扬/接管/协商 |
| Belief | （无） | 必须优秀/失败很危险/孩子还做不到 |
| Routine | （无） | 作业流程/睡眠安排/家庭会议 |
| Episode | EpisodeRow | 一次冲突/一次共同解决问题 |
| Context | sceneTags | 考试/工作压力/经济压力/转学 |
| Resource | （无） | 伴侣支持/祖辈协助/学校资源 |
| Goal | parentGoals | 独立完成/改善沟通/稳定情绪 |
| EvidenceAtom | FactAtom | 原始证据及来源 |
| MechanismHypothesis | CandidateMechanism | 候选机制 |

**边类型**（14 类）：

```
performs        （人-行为）
responds_to     （行为-行为，时序）
supports        （因素-机制，正向）
constrains      （因素-机制，限制）
amplifies       （机制-机制，放大）
buffers         （因素-机制，缓冲）
triggers        （情境-行为）
precedes        （事件-事件，时序）
co_occurs_with  （事件-事件，共现）
contradicts     （证据-假设，反证）
reported_by     （证据-人，来源）
evidence_for    （证据-机制，支持）
evidence_against（证据-机制，反对）
part_of         （节点-子系统，隶属）
```

每条边带属性：方向 / 正负作用 / 时间范围 / 关系强度 / 来源 / 可信度 / 适用情境 / epistemic_status。

### 3.5 超图与多方关系

家庭事件常非两两关系——一次晚餐冲突同时涉及父亲、母亲、孩子、作业压力、时间紧张。强行拆成多个二元边会丢失事件整体性。

**超图（Hypergraph）** 允许一条超边连接 >2 个节点，表达"多方共同参与"。超图神经网络（HGNN）已为高阶关系建模提出。

**映射到育见**：对"多方共现事件"用事件节点（Episode 节点）+ 多条 `part_of` 边，或直接用超边。MVP 阶段先用事件节点 + 二元边（工程简单），数据成熟后再考虑超图。

### 3.6 时序图

家庭关系随时间变化，是**动态图**而非静态图。时序图网络（TGN, Rossi et al. 2020）为动态图设计。

**映射到育见**：`FamilyInteractionCycle` 已有 `version` + `previousVersionId` 版本链，这是时序图的雏形。但当前 version 是"整图快照"，不是"边增量"——MVP 阶段够用，长期可演进为边级时序。

---

## Part 4 · 加权非堆叠：消息函数 φ_r 按关系类型分叉

你说"滤波、特征提取、加权求和、调整权重"——方向对，但权重不能是笼统的重要性分数。

### 4.1 消息传播的数学抽象

```
m_{u→v}^{(r,t)} = φ_r( h_u, h_v, e_{uv}, context, Δt, provenance )

h_v^{l+1} = ψ( h_v^l, Σ_{u,r} α_{u,v,r,t} · m_{u→v}^{(r,t)} )
```

- `φ_r`：按关系类型 r 分叉的消息函数（"支持"和"控制"不同函数）
- `α`：注意力/门控权重，不是单一重要性，是多因子乘积

### 4.2 α 的多因子构成

```
α = 关系类型先验
  × 证据来源可靠度
  × 时间衰减
  × 出现频率
  × 情境相关性
  × 多来源一致性
  × 保护或风险方向
  × 模型学习权重
```

### 4.3 为什么不能线性相加

**五个"不能"**（基于家庭研究的硬约束）：

1. **"支持"不能和"控制"用同一个消息函数**——前者缓冲，后者放大，方向相反，用同一个 φ 会互相抵消成 0。
2. **"父亲对孩子"不能默认等同"孩子对父亲"**——方向不对称（APIM 的 actor ≠ partner）。
3. **"一次严重冲突"不能等同"五次轻微不耐烦"**——频率 × 强度是非线性组合，不是加法。
4. **"高频但低可信度的单方报告"不能压过"低频但多来源一致的证据"**——可信度 × 频率是非线性，单源高频是偏差不是信号。
5. **正向保护因素不能只作负向风险的抵消项**——保护因素可能**改变整个机制路径**（不是减法，是路径切换）。

### 4.4 育见的 φ_r 设计原则

- 每种边类型有自己的 `φ_r`，不共享权重
- `φ_r` 输入：两端节点表示 + 边属性 + 情境 + 时间差 + 来源
- `φ_r` 输出：消息向量（带正负方向）
- 聚合 `ψ` 用注意力加权，而非简单求和
- MVP 阶段 `φ_r` 用**领域规则 + LLM 受约束推理**实现，不训练神经网络（见 Part 6）

---

## Part 5 · 混合体非归因：SRM/APIM 四分量 + 多机制混合

你说"家庭和家长都是复杂混合体，是多种关系的权重合并，不要简单归因"——这是整个系统的伦理和方法论核心。

### 5.1 Social Relations Model（SRM）四分量分解

Kenny & La Voie (1984) 把一次人际观察拆为：

```
y_{i→j} = μ + A_i + P_j + R_{ij} + F_family + C_c + T_t + S_s + ε
```

- `A_i`：行为者效应（i 自身倾向）
- `P_j`：对象效应（j 的状态/需求）
- `R_{ij}`：两人独特关系效应
- `F_family`：家庭层共同氛围/规则
- `C_c`：情境（作业/睡眠/出门）
- `T_t`：时间/发展阶段
- `S_s`：信息来源（父述/母述/孩述/系统推断）
- `ε`：未观察因素

### 5.2 APIM 的双向效应（Cook & Kenny 2005）

Actor-Partner Interdependence Model 强调：
- **actor effect**：本人的预测变量影响本人的结果
- **partner effect**：对方的预测变量影响本人的结果
- 两个效应在**同一模型**里估计，显式建模残余相互依赖
- **关键警告**：模型中的预测关系**不自动等于因果关系**（Cook & Kenny 原文脚注 1）

### 5.3 错误输出 vs 正确输出

**错误**（简单归因）：
> "因为妈妈控制欲强，所以孩子拖延。"

这把 `A_mother` 当成了唯一原因，忽略了 `R_{mother,child}`、`F_family`、`C_homework`、`T_recent`。

**正确**（关系机制推理）：
> "在近期作业情境中，家长对结果的担忧、较高频率的即时督促以及孩子的回避反应多次共同出现，可能形成了一个'担忧—督促—回避—加强督促'的循环。现有信息尚不能排除任务难度、睡眠不足或注意力状态等其他解释。"

这同时呈现：观察到的互动模式 + 可能的循环 + 支持证据 + 不能排除的替代解释 + 把握程度。

### 5.4 家庭网络分析的实证支持（Nature 2025）

Jiang et al. (2025) *Family dynamics on mental health: a network analysis*（npj Mental Health Research）用网络分析研究 3750 个家庭，发现：

- 家庭成员心理症状**双向影响**，不是单向
- **母亲抑郁**是家庭网络中**最强预测节点**（expected influence 最高）
- **年长同胞**是连接到年幼同胞的**最强桥梁节点**（bridge symptoms）
- 存在**溢出效应**：一个子系统的动态影响另一个子系统

**对育见的启示**：
1. 不能只看亲子二元，要建模**多成员网络**（含同胞/祖辈/老师）
2. 要计算**中心性**（哪些节点 expected influence 最高）——这决定"先干预什么"
3. 要识别**桥梁节点**——连接不同子系统的症状/行为，往往是杠杆点
4. 研究明确指出**单一报告者偏差**和**不能直接确定因果路径**——产品必须从第一天保存来源和不确定性

### 5.5 多机制混合输出

家庭状态不是单一结论，而是：

```
FamilyState(t, c) = Σ_k π_k(t, c) · M_k + Interactions + Uncertainty
```

- `M_k`：候选机制
- `π_k(t,c)`：机制在特定时间/情境的权重
- 同一家庭可同时存在多个**相反**机制
- 权重随时间/场景变化

**示例**：一个家庭可能同时存在：
```
高支持 × 0.72
焦虑驱动的督促 × 0.61
规则不稳定 × 0.46
亲子修复能力 × 0.68
孩子近期疲劳 × 0.57
```

这不意味着家长是"控制型家长"。它意味着：某些情境下焦虑督促循环明显，但家庭同时有较好的情感支持和冲突修复能力，后者可能是调整路径中的保护因素。

---

## Part 6 · 注意力权重 ≠ 原因：硬规则

这是系统级硬规则，不可妥协。

### 6.1 学术依据

Wiegreffe & Berant (2019) *Attention is not Explanation*（ACL）证明：注意力权重经常**无法作为可靠解释**。高注意力的边不代表它是真实原因。

对 GNN，同样需要额外的解释方法（如 GNNExplainer 找关键子图），而不是直接把内部权重翻译成人类结论。

### 6.2 育见的硬规则

面向家长的解释**必须**来自**可追踪的证据路径**，不是模型权重。至少包含：

```
观察到了什么（事实层）
可能形成了什么循环（机制层）
支持该判断的证据（证据层）
与判断矛盾的证据（反证层）
还有哪些替代解释（假设层）
当前把握程度（置信层）
什么新信息会改变判断（可证伪层）
可以做什么低风险小实验（行动层）
```

### 6.3 语言规则（非归罪表达）

**禁用**：
- "你是……型家长"
- "孩子这样是因为你……"
- "根本原因就是……"
- "模型认为某条边权重最高"

**改用**：
- "在这些情境中更容易出现……"
- "目前可能存在这样一个循环……"
- "这一判断同时受到……因素影响……"
- "现有证据还不足以排除……"
- "可以通过一次小范围调整进一步验证……"

---

## Part 7 · 认识论隔离：observed/reported/derived/inferred 必须严格分层

### 7.1 Atom 的认识论状态（epistemic_status）

你提供的资料里最关键的一点：Atom 必须区分认识论状态，且**绝不能把 hypothesized 在下一轮当成 observed 再传播**。

```
observed        直接观察或明确陈述
reported        某位家庭成员的主观报告
derived         由多条证据计算得到
inferred        模型推断
hypothesized    待验证的机制假设
expert_confirmed 专业人员确认
```

### 7.2 代码实证：当前 atom 的缺口

| 字段 | 是否存在 | 实际 |
|---|---|---|
| sourceType | ✅ | child_quote / material_observation / parent_explicit |
| epistemic_status | ❌ | 不区分 observed/reported/derived/inferred |
| confidence | ❌（三档） | evidenceStrength: low/medium/high，非数值 |
| subject/object | ❌ | 无主体/客体节点 |
| relation_type | ❌ | 无关系类型 |
| time | ❌（仅 DB 时间戳） | 无业务时间 |

**最大数据损失点**：抽取器内部有 `evidenceTier`（behavior/verbatim/repeated/cross_scene/outcome_checked）和 `factRole`（presenting/trigger/response/counter/context），**但这两个字段未持久化到 fact_atoms 表**。这是 GNN 映射的最大障碍——抽取时已知的高价值认识论信息，写库时丢了。

### 7.3 推断自我强化的危险

如果 `inferred` 的结论在下一轮被当成 `observed` 的事实再传播：
- 第 1 轮：LLM 推断"孩子可能用拖延逃避控制"
- 第 2 轮：这个推断被当事实，推出"拖延=逃避控制已成定论"
- 第 3 轮：基于"定论"推出更深的"根因是母亲控制型人格"

3 轮后，一个**推断**变成了**诊断**，且无法回溯。这就是过平滑 + 噪声传播在产品层面的具象化。

### 7.4 解决：认识论单向流

```
observed → reported → derived → inferred → hypothesized
（可信度递减，传播权限递减）

hypothesized 不能升级为 observed，只能：
- 被 ≥2 个独立来源印证 → 升级为 derived
- 被反证 → 降级为 dismissed
- 持续无新证据 → 维持 hypothesized（不自动升级）
```

---

## Part 8 · 现有代码的图语义就绪度

基于代码实证，现有结构里哪些已经是图、哪些是扁平：

### 8.1 已经是图/关系语义的（不要推翻，要扩展）

| 结构 | 图语义 | 缺口 |
|---|---|---|
| `FamilyInteractionChain`（8字段链） | 有向时序因果链，7 条隐式边 | 字段是字符串非节点引用；无 subject/object ID |
| `DossierFactor` + `fivePs` | 因素节点（有 id/confidence） | 无显式边连接 factor 之间 |
| `DossierSceneReading.mainPerpetuatingId` | 场景→因素 引用边 | 唯一显式引用，仅 1:1 |
| `DossierSceneReading.protectiveMix` | 场景→保护因素 加权边 | 键是 label 非 id |
| `CandidateMechanism.supportedByEntries` | 机制→入口模块 隶属边 | 入口是枚举非节点 |
| `RetrievalIndex` | item→tag 二部图 | 跨层引用但无类型化关系 |
| `Episode → FactAtom` | episode→atom 从属边（episode_id 外键） | **唯一持久化外键** |
| `FamilyInteractionCycle.previousVersionId` | 版本链（时序图雏形） | 整图快照非边增量 |

### 8.2 仍是扁平特征的（需要图化）

- `AtomRow.content` —— 纯文本，无三元组
- `EntryEvidencePack.decomposedInput` —— 维度桶装字符串数组
- `CrossEntryEvidence` 的所有 `xxx[]` —— 扁平字符串数组
- `TurnEvent.userMessage` —— 单字符串
- `DailyInteractionUpdate.newInput` —— 单字符串
- `ParentNarrativePattern` —— tendency 枚举 + observations 字符串数组

### 8.3 memory_layer_items 的 31 个 layer_name

实际 31 个（非之前以为的 24 个）。已有图结构的层：
- `evidence_networks`（机制矩阵 + 跨入口证据）
- `interaction_cycles`（8字段时序因果链 + 版本链）
- `deep_model_digest`（dossier 因素节点 + 隐式边）
- `retrieval_indexes`（item→tag 二部图）

仍是扁平的层：`raw_materials` / `cleaned_facts` / `entry_evidence_packs` / `daily_updates` / `turn_events` / `parent_narrative_patterns` / `child_structure_models` / `conditional_profiles` / `pending_hypotheses` 等。

---

## Part 9 · 落地路线：不训练 GNN，先建关系本体

### 9.1 为什么不先训练 GNN

- 家庭数据无大规模标注
- 单一报告者偏差严重（Nature 2025 明确指出）
- GNN 训练需要多家庭/多时间点/多来源/专家标注
- 训练前的 GNN 是黑盒，无法满足"非归罪解释"硬规则

### 9.2 三阶段路线

**阶段 1：关系本体 + 证据契约**（对应 product-memory-architecture Layer 2）
```
Raw Input → Atom Extraction（带 epistemic_status）
→ Schema Validation → Evidence Store → Family Graph
```
- Atom 定义稳定（补 epistemic_status / subject / object / relation_type / business_time）
- 节点和边类型稳定（Part 3.4 的 12 节点 + 14 边）
- 来源可追踪、时间可追踪
- **观察和推断严格隔离**（Part 7）
- 每次推理绑定 `graph_version` + `schema_version`
- 持久化现在丢失的 `evidenceTier` / `factRole` / `ecologicalLayer`

**阶段 2：可解释的关系传播引擎**（对应 deep-portrait-v4）
```
领域规则 + 关系类型权重 + 时间衰减
+ 证据可信度 + LLM 受约束推理
```
- 不用训练后的神经网络
- `φ_r` 用规则 + LLM 实现，可验证、可在缺数据时上线
- 产出多机制混合（Part 5.5），不是单一结论
- 输出绑定证据路径（Part 6.2），不是权重

**阶段 3：数据成熟后学习局部权重**（长期）
- 积累多家庭/多时间点/多来源/家长反馈/干预前后/专家标注后
- 学习：关系权重 / 时间衰减 / 路径选择 / 子图表示 / 个体化机制参数
- 仍保留可解释层（学习权重用于排序，不用于直接展示）

### 9.3 Agent 分工（基于你的资料）

```
Evidence Ingestion → Atomizer Agent → Schema/Provenance Validator
→ Family Graph Service → Mechanism Inference Job
→ Alternative Hypothesis Agent → Non-blame/Safety Reviewer
→ Narrative Agent → Insight Persistence → BFF → Frontend
```

**职责边界**：
- Atomizer：提取证据原子，**不做最终归因**
- Graph Service：维护节点/边/版本/时间/来源
- Mechanism Agent：调 LLM + 图查询，形成候选机制
- Alternative Agent：找反证/替代解释/缺失变量
- Safety Reviewer：检查标签化/归罪化/病理化/因果越界
- Narrative Agent：转家长可理解的表达
- **验证/状态转换/幂等/重试/字段检查必须由确定性代码完成，不交给 Agent 自由判断**

---

## Part 10 · 与既有文档的关系

| 文档 | 层次 | 本文位置 |
|---|---|---|
| `product-memory-architecture.md` | 产品架构总纲 | 本文是其 Layer 2/4 的理论依据 |
| `deep-portrait-v4-multihead-triangulation.md` | 画像结构升级（v4） | 本文是其理论奠基 |
| `dossier-v3-fullchain-audit-and-improvement-plan.md` | 工程 P0 断点 | 本文不涉及，仍有效 |

**执行顺序**：
1. 先做 product-memory-architecture Layer 0-1（管道通 + 写入批量）
2. 再做本文阶段 1（关系本体 + 证据契约 + 认识论隔离）——这是 Layer 2 的前置
3. 再做 deep-portrait-v4（多头 + 三角验证 + 假设池）——这是本文阶段 2
4. 长期做本文阶段 3（学习权重）——这是 Layer 4

---

## 附录 · 文献索引

| 文献 | 核心贡献 | 育见借鉴 |
|---|---|---|
| Battaglia et al. 2018, *Relational inductive biases, deep learning, and graph networks* (arXiv:1806.01261) | 图网络统一框架；关系归纳偏置 | 节点提供内容，关系决定如何理解 |
| Li et al. 2018, *Deeper Insights into GCN* (AAAI) | 过平滑首次系统分析 | 深度≠层数 |
| Oono & Suzuki 2019, *GNN Exponentially Lose Expressive Power* | GCN 表示秩随深度指数收敛到 1 | 2-4 层就过平滑 |
| ICLR'23 非渐近分析 | 过平滑在浅层就发生 | 不要堆层 |
| Rossi et al. 2020, *Temporal Graph Networks* (arXiv:2006.10637) | 动态图深度学习 | 家庭关系是时序图 |
| Zhu et al. 2025, *RHGNN* (Springer) | 异构图关系归纳偏置 + Type2vec | 统一异构图，不靠 meta-path 拆分 |
| Kenny & La Voie 1984, *Social Relations Model* | 人际观察四分量分解 | A/P/R/F 分解 |
| Cook & Kenny 2005, *APIM* (Int J Behavioral Dev) | 双向效应模型；预测≠因果 | actor/partner 同时估计；不归因 |
| Jiang et al. 2025, *Family dynamics on mental health: a network analysis* (npj Mental Health Research) | 家庭心理症状网络；母亲抑郁最强预测；同胞是桥梁 | 多成员网络 + 中心性 + 桥梁节点 + 单一报告者偏差 |
| Wiegreffe & Berant 2019, *Attention is not Explanation* (ACL) | 注意力权重≠解释 | 权重不直接展示为原因 |
| Battaglia et al. 2018, GN 框架 φ_v/φ_e/φ_u | 按关系类型分叉的消息函数 | φ_r 设计 |
| Hypergraph Neural Networks | 超图高阶关系 | 多方事件用事件节点或超边 |
