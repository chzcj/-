# v3 全链路逐节点改造清单 + 最初问题反思（替换单薄版）

> **为什么重写**：上一版 v3 plan 被你判为"简单单薄，支撑不起来"。原因：它停在"形态设计"（dossier 长什么样、三步工作流叫什么），没有扎根在全链路每一处真实字段和函数上。这次我把全链路从"家长输入"到"prose 输出"的每个节点逐行读了，写一份**逐节点改造清单**，并诚实反思最初问题到底实现了没有。
> **状态**：思考与设计，不改代码。理论真源已用 textutil 提取 docx 全文核对（15 张卡 × 9 字段）。

---

## Part 0 · 诚实反思：最初问题实现了吗？

你的最初问题（原文）有 6 个具体诉求。逐条兑现状态：

| # | 最初诉求 | 当前状态 | 是否兑现 |
|---|---------|---------|---------|
| 1 | Job A `episode_ingest` vs Job B `memory_write` 区别 | 已逐字段说清（episode=语义轴记"发生过什么"+向量化；memory_write=结构轴记"我们怎么理解"+不向量化） | ✅ 兑现 |
| 2 | THEORY_CARDS 和 sharedContext 家长输入扩到 100 条 | 发现真源：`getMergedParentInputHistory(tenant, 100)` 已取 100，但 `pipeline.ts` 喂 LLM 只用 `slice(-30)`。**1 行可改** | ⚠️ 半兑现（诊断对了，方案给了，没落地） |
| 3 | deepMechanismReview.md 做 prompt cache | 发现真源：理论卡作为 user payload 传，每次 miss。方案：移 system 尾部。**没落地** | ⚠️ 半兑现 |
| 4 | deepMechanismReview.md 每 10 次对话再调用 | 发现真源：`turn-signal.ts` `MILESTONE=10` **已存在**，S2 默认开。但你不知道，且 5 路触发叠加没去重 | ⚠️ 半兑现（功能在，但触发混乱） |
| 5 | 批判机制卡刻板/不融合/像豆包，要三步工作流（输入→分类→整合理解） | 形态设计对了（dossier + 三步），但**没扎进真实字段流**，所以单薄 | ❌ 形态对、落地空 |
| 6 | 试验性展示：不用机制卡的画像 | 写了小宇样例（v2/v3），但被你判"仍单调/简单单薄" | ❌ 不达标 |

**核心反思**：6 条里 1 条真兑现，3 条诊断对但没落地，2 条形态对但没扎根。**问题不在"想得不够深"，在"没读够细"**——我之前只读了核心文件概览就写方案，没逐字段逐函数追"这个字段从哪来、到哪去、改它会牵动谁"。这次补上。

---

## Part 1 · 全链路逐节点字段流（真读，非概览）

这是当前真实的"家长一句话 → prose 输出"全链路，每节点标了文件、函数、字段、slice 上限。**v3 改造要动哪里，看这一节就清楚**。

### 节点 0 · 家长输入进系统
- 入口：`app/api/daily/stream/route.ts` 收到 text → `runDailyTurnBff`
- 同步写：`turn_events`（L0，每轮必写）
- 异步入队：`episode_ingest`（反证/材料轮）+ `memory_write`（有效轮）

### 节点 1 · 规则编排（不调 LLM）
- 文件：[`orchestration/pipeline.ts`](/Users/mac/Desktop/育见-2/src/lib/server/orchestration/pipeline.ts) `runOrchestrationPipeline`
- 产出 `OrchestrationOutput`：`inputType` / `relationshipToExistingModel.type`(safety/insufficient/new_mechanism/counter_evidence/old_repetition) / `routingDecision`(frontResponseType/needFollowup/followupQuestion) / `retrievedContext`
- **关键**：orchestration 内部调 `buildDailyDialogueRetrievalPacket`（节点 2）填 `retrievedContext`

### 节点 2 · 检索路由（不调 LLM，10 路并行读库）
- 文件：[`memory/retrieval/router.ts`](/Users/mac/Desktop/育见-2/src/lib/server/memory/retrieval/router.ts) `buildDailyDialogueRetrievalPacket`
- 10 路并行：`getConditionalProfiles` / `getEntryEvidencePacks` / `getDailyInteractionUpdates` / `getPendingHypotheses` / `getLatestEvidenceNetwork` / `getLatestChildStructureModel` / `getFamilyInteractionCycles` / `getLatestBuiltProfileSnapshot` / `getBuildProgress` / `getParentNarrativePattern`
- 额外：`getMergedParentInputHistory(tenant, 100)` 取 100 条做候选事实池
- 三级降级检索：Episode 语义 → 向量精排 → 取最近
- 产出 `DailyDialogueRetrievalPacket`（19 字段），其中：
  - `matchedMechanisms = formatMatchedMechanisms(network?.candidateMechanismMatrix)` ← **卡矩阵在这里变成人话卡**
  - `possibleCounterEvidence: []` ← **恒空**（死字段，反证通道断）
  - `entryFacts` 直喂四模块 verifiableFacts/childBehaviors/triggerPoints/triedMethods/parentDisagreements/companionshipTime/childInterests/subjectStates（slice 80）
  - `childQuotes` 从 packs 行为里抽带引号/短句（slice 32）

### 节点 3 · 厚包切片（不调 LLM）
- 文件：[`daily/frontend-read-pack.ts`](/Users/mac/Desktop/育见-2/src/lib/server/daily/frontend-read-pack.ts) `pickFrontendReadPack`
- 10 字段厚包上限：childStructureModels:24 / entryEvidence:24 / entryFacts:80 / matchedMechanisms:**40** / familyPatterns:20 / parentUnderstanding:24 / recentEvents:24 / pendingHypotheses:20 / childQuotes:32 / parentVerbatimSnippets:32
- **关键发现**：`matchedMechanisms` 厚包上限 40，但 `formatMatchedMechanismCards` 内部又 slice 20——**两道 slice 不一致**（s6 审计提过 H9，但只改了 hub/refresh，daily 这条仍是 40→20）

### 节点 4 · digest 加载（不调 LLM，确定性拼）
- 文件：[`daily/daily-turn-bff.ts`](/Users/mac/Desktop/育见-2/src/lib/server/daily/daily-turn-bff.ts) `ensureDigestPack`
- `loadDeepModelDigest(tenant)` 读 `deep_model_digest` 层；空则 `buildDeepModelDigest(tenant)` 现算
- `pickDeepModelDigestPack` 切片：mechanismNarrative(整段) / interactionLoops:12 / anchoredFacts:24 / parentVerbatimSnippets:16 / childQuotes:16 / openHypotheses:12 / structuralTensions:8
- **关键发现**：digest 与 orchestration **并行**（`Promise.all`），digest 不依赖本轮输入

### 节点 5 · prose payload 组装（不调 LLM）
- 文件：[`daily/prose-context.ts`](/Users/mac/Desktop/育见-2/src/lib/server/daily/prose-context.ts) `buildDailyProsePayload`
- 稳定前缀：`packReadingGuide`(10 字段说明) + `retrievalPack`(节点3切片) + `deepModelDigest`(节点4切片) + `writingRules`
- 动态后缀：`userText` / `proseMode` / `maxChars` / `inputType` / `relationshipType` / `responseType` / `suggestedFollowup`
- **关键发现**：`packReadingGuide` 里 `matchedMechanisms` 的引导是"翻译成生活语言，禁止理论卡名"——但字段里装的就是"名+描述+依据+保护"的卡拼接，前台只能贴

### 节点 6 · LLM 调用（烧 token 主战场）
- 文件：`daily/prose-section-stream.ts` `streamProseAndSections`（合并 prose + visible section 一次调用）
- system = `combinedProseSystem()`（parentFacingStyle + dailyDialogueOrchestration + copy）
- user = 节点5 payload
- **关键发现**：visible section 与 prose **同一次调用**，hidden section **另一次调用**（`fillDailySectionCopy`，也带 digestPack）——**hidden 再喂一遍类似的厚包**，这正是你说的"hidden 卡片还会再喂一遍类似的包"

### 节点 7 · 后台深度链（不阻塞前台）
- 文件：[`deep-mechanism/pipeline.ts`](/Users/mac/Desktop/育见-2/src/lib/server/memory/deep-mechanism/pipeline.ts) `runDeepMechanismReview`
- 4 步：`ecosystemClassifier` → `theoryMatcher` → `mechanismSynthesizer` → `structuralRiskExtractor`
- `sharedContext.dailyUpdates = inputHistory.slice(-30).map(h=>h.text)` ← **诉求2 的真源：喂 LLM 只 30 条**
- `THEORY_CARDS` 作为 user payload 传 ← **诉求3 的真源：理论卡没进 cache**
- 5 路触发：日桶 / 每条 episode / 每10轮 / 登录 / 四模块齐 ← **诉求4 的真源：已存在但叠加**

### 节点 8 · 卡矩阵怎么变 prose（关键链路）
- `evidence_networks.candidateMechanismMatrix`（后台产出，10-20 条）
- → `formatMatchedMechanismCards`（节点2）拼成"名。描述。依据：xxx。可能在保护：xxx"
- → `matchedMechanisms`（厚包 slice 40，内部再 slice 20）
- → `retrievalPack.matchedMechanisms` 进 prose payload
- → parentFacingStyle §三"matchedMechanisms：内部匹配模式，只作内部参考"
- → dailyDialogueOrchestration §1"matchedMechanisms：系统匹配到的历史相似模式"
- → LLM 贴卡进 prose
- **这就是"像豆包"的完整因果链**：后台产卡矩阵 → 格式化成卡描述 → 厚包直喂 → SP 引导"翻译" → LLM 贴卡

---

## Part 2 · v3 改造：逐节点该动哪里（扎根版）

上一版只说"建 dossier"，没说"改哪个函数哪个字段"。这次逐节点列。**理论卡保持原名不重命名**（你的要求），但内涵按报告 15 张 × 9 字段重建。

### 改造点 A · 节点7 后台深度链（诉求 2/3/4 落地）
| 子项 | 文件:行 | 改什么 | 风险 |
|------|---------|--------|------|
| A1 输入窗口 100 | `pipeline.ts` sharedContext `slice(-30)` → `slice(-100)` + 单条 trunc 200 字 | 1 行 | 低 |
| A2 理论卡进 system | `pipeline.ts` `{ecosystemMap, theoryCards}` 从 user 移到 theoryMatcher 的 system 尾部 | 改 callDeepAgentJson 调用方式 | 中 |
| A3 触发去重 | `jobs/queue.ts` + `turn-signal.ts`：5 路触发加 debounce 15min + reason 标注 | 加去重逻辑 | 中 |
| A4 日桶不跑满链 | 日桶触发改为只跑 `digest_update`，不跑 4 步 deep | 改 job handler | 低 |

### 改造点 B · 节点8 卡矩阵→dossier（诉求 5/6 落地，核心）
| 子项 | 文件 | 改什么 | 风险 |
|------|------|--------|------|
| B1 新增 portraitSynthesizer | 新文件 `deep-modeling/portrait-synthesizer.ts` | 取代 mechanismSynthesizer 为主路径，输出 `FamilyUnderstandingDossier` | 高（新链路） |
| B2 dossier 存储 | 新表 `family_understanding_dossiers` 或扩展 `deep_model_digest` schema v2 | 存底稿 10 字段 | 中 |
| B3 digest-builder 改投影 | `digest-builder.ts` + `llm-digest-builder.ts` | 从取 `topMechanism.description` 改为投影 `dossier.integratedSynthesis` + 分段 | 中 |
| B4 pick-deep-model-digest 改字段 | `pick-deep-model-digest.ts` | `mechanismNarrative` → `coreUnderstanding` + `contextualStates` + `interwovenField` | 中（契约变） |
| B5 formatMatchedMechanismCards 降级 | `pick-deep-model-digest.ts` | 保留作兜底，dossier 缺失时才用 | 低 |
| B6 反证通道修复 | `router.ts` `possibleCounterEvidence: []` | 从 episode counter_evidence atom 真填 | 中 |

### 改造点 C · 节点2/3 厚包字段（诉求 5 前台侧）
| 子项 | 文件 | 改什么 | 风险 |
|------|------|--------|------|
| C1 retrievalPack 加 dossier 切片 | `frontend-read-pack.ts` + `router.ts` | 新增 `dossierSlice` 字段（按本轮 query 切 contextualStates） | 中 |
| C2 matchedMechanisms slice 统一 | `frontend-read-pack.ts` 40 vs `formatMatchedMechanismCards` 20 | 统一为一个常量 | 低 |
| C3 read-contract 更新 | `docs/contracts/read-contract.md` | matchedMechanisms 厚包 20 → dossier 切片字段 | 低（文档） |

### 改造点 D · 节点5/6 前台 SP（诉求 5 表达侧）
| 子项 | 文件 | 改什么 | 风险 |
|------|------|--------|------|
| D1 parentFacingStyle 字段引用 | `prompts/core/parentFacingStyle.md` §三 | `matchedMechanisms` 引导改为 `dossierSlice.coreUnderstanding` + `interwovenField` | 中 |
| D2 dailyDialogueOrchestration | `prompts/front/dailyDialogueOrchestration.md` §1 | 同上，弱化 interactionLoops 五步链 | 中 |
| D3 prose-context packReadingGuide | `prose-context.ts` `PACK_FIELD_GUIDE` | 加 dossierSlice 引导，matchedMechanisms 标注"兜底用" | 低 |
| D4 deepModelDigestBuilder SP | `prompts/back/deepModelDigestBuilder.md` | 单字段 mechanismNarrative → 多维投影 | 中 |

### 改造点 E · 理论卡真源（诉求 5 理论侧）
| 子项 | 文件 | 改什么 | 风险 |
|------|------|--------|------|
| E1 theory-cards 重建 | `theory-cards.ts` | 按报告 15 张 × 9 字段重建（保持卡名体系不重命名，但补 rich fields） | 高 |
| E2 SP 单源 | `deepMechanismReview.md` + `theoryMatcher` SP | 理论卡从 SP 文本 + 代码双源 → 代码单源，SP 只引用 | 中 |
| E3 MVP 分批 | `theory-cards.ts` | 第一批 4 张（教养控制/强制循环/家校合作/发展任务）先上，报告路线图 | 低 |

### 改造点 F · 宪法与契约（必先改，否则冲突）
| 子项 | 文件 | 改什么 | 风险 |
|------|------|--------|------|
| F1 deep-modeling.md | `docs/product/deep-modeling.md` §2/§7 | "机制闭环强制""互动循环五步" → "证据分层+整合底稿+理论隐身" | 中（宪法级） |
| F2 DESIGN.md 记忆来源 | `DESIGN.md` | 画像 Tab 卡片来源从 matrix → dossier 投影 | 低 |

---

## Part 3 · 最初问题逐条再回应（扎根版）

### 诉求 1（Job A vs B）—— 已兑现，不重复

### 诉求 2（100 条）—— 落地点明确
`pipeline.ts` sharedContext `slice(-30)` → `slice(-100)`。**1 行，Phase B 即可**。但要加单条 trunc 200 字防爆 prompt。

### 诉求 3（prompt cache）—— 落地点明确
`pipeline.ts` 把 `THEORY_CARDS` 从 user payload 移到 theoryMatcher system 尾部。**理论卡那 ~2k token 进缓存前缀**。需验证 DeepSeek 前缀缓存对 system 尾部生效（一般生效）。

### 诉求 4（每 10 轮）—— 已存在，问题是叠加
`turn-signal.ts` `MILESTONE=10` 已在。但 5 路触发叠加（日桶+每条episode+每10轮+登录+四模块）导致实际远不止"每 10 轮一次"。**v3 要做的是去重，不是新建**。

### 诉求 5（三步工作流 + 整合理解）—— 核心改造，分两层
- **数据层**（改造点 B）：dossier 取代卡矩阵作为 digest 主源，formatMatchedMechanismCards 降级兜底
- **表达层**（改造点 D）：前台 SP 引用 dossierSlice 而非 matchedMechanisms
- **理论层**（改造点 E）：theory-cards 按报告 15 张 × 9 字段重建，理论隐身作 SP 透镜

### 诉求 6（试验画像）—— 上一版不达标，重做
你判 v3 §4 样例"简单单薄"。问题在：它仍是"分段填字段"的思维（这个孩子是谁/家怎么运转/父母各自/从哪撬），每段内部还是单调论述。**真正的"交织"应该是：同一段落里，多个功能同时在场、互相改变，读不出来"这是功能1那是功能2"**。

重做样例见 Part 4。

---

## Part 4 · 试验画像重做（真正交织，非分段填字段）

> 同一小宇家庭。这次不按"孩子是谁/家怎么运转/父母各自/从哪撬"分段（那是填表），而是写一段**真正读不出功能边界**的理解。核心：拖延不是"保护可控感"这一个等式，而是几样东西在同一刻同时成立、且彼此喂养。

---

小宇这孩子，问题从来不是"作业"。

他是个接收得太多的人。妈妈往书桌边一站，话还没出口，他身体已经先紧了——这种紧不是装的，是他这类孩子天生的底色，外界信号他接得比谁都快。所以当妈妈用"我是为你好"的关切站到他旁边时，落到他身上的是两层完全不同的东西：一层是关心，一层是"我又在被盯着了"。这两层同时存在，他没法只接住一层。

他拖延，但拖延里装的不是一样东西。作业开始前那一段，他在抢一样几乎抢不到的东西——今晚节奏的最后一小点决定权。妈妈已经把今晚排满了，只有"什么时候动笔"这一个口子还在他手里，他不松。但同一个拖延里，还混着他对"一动笔就暴露不会"的怕——他是高自尊的孩子，做错比不做更难忍受，拖着至少没人看见他错。还混着一丝对妈妈连番指挥的消极抵抗——"你让我开始我偏不开始"。这三样在同一刻同时成立，谁也压不掉谁，而且互相喂养：越怕暴露不会就越拖，越拖妈妈越催，越催消极抵抗越重，越抵抗越要靠拖延保住那点自主。这不是三个功能叠加，是一个稳态——它们只有一起在的时候，这个晚上才能维持住。

所以"治拖延"治不了。因为他不是在拖延，他是在用拖延同时撑住三样正在一起塌的东西。

妈妈看不见这三样。她看见的是"态度差""不自觉"。这不是她不细心，是她站在妈妈的位置上，只能看见自己投入了多少、孩子回报了多少。她一个人扛着这孩子的整个学习——爸爸长期不在场，没有第二个人说"今晚我来"，所以她的焦虑没有出口，只能更紧，更紧就更盯，更盯孩子就更退。她不是控制欲强，她是被这套结构逼到只能用"盯"来表达关心。孩子接收到的"被盯"和妈妈发出的"关心"，是同一件事的两种语言，两个人都在说真话，但谁也听不懂谁。

踹门那一次，不是孩子变坏了。是这套结构绷到极限发出的声音。妈妈越用力，孩子越退进沉默；孩子越沉默，妈妈越觉得"不管不行"。这个循环里没有坏人，只有两个都在努力、却把彼此越推越远的人。

要帮的不是先改孩子的态度。态度不是因，是这三样东西一起塌出来的形状。真正能撬的，是先看清：在哪一种条件下，这三样会松开一点点。选一晚，妈妈在作业开始前 20 分钟完全不进房间、不催——这一晚不是治拖延，是测一件事：如果"被盯"这个力撤掉，拖延会不会也松一点。如果松了，说明消极抵抗和保自主是主因，方向是"给空间"；如果还拖，说明怕暴露不会才是底，要换一个支点。这不是答案，是用一个小实验，去拆开目前混在一起、谁也说不清的那三样东西。

这一晚之后还要看：爸爸单独在场时他是否还拖；沉默之后妈妈会不会间歇性放松（如果有，他学到的就是"扛过最紧就会松"，沉默会被强化）；冲突之后有没有人去修复（如果从来没有，那不只是作业问题，是这套结构里缺了一块很重要的东西）。

理解一个孩子，不是给他一个结论。是越看越清楚他到底在同时撑住什么，然后找一个最小的口子，让那几样东西先松开一点。

---

### 这版为什么比上一版"深"
- 不分段填字段，是一段连贯的理解，读完认识这个人
- 拖延不是"=保护可控感"一个等式，是"三样同时成立、互相喂养、谁也压不掉谁"——**读不出功能边界**
- 妈妈不是"专制型/焦虑驱动型"标签，是"被结构逼到只能用盯表达关心"——**不审判**
- 踹门不是"变坏"，是"结构绷到极限的声音"——**去病理化**
- 支点不是"治拖延"，是"测哪一样会松"——**可验证**
- 理论全隐身（依恋/强制循环/SDT/ABC-X 都在思考里，没出现在文字）

---

## Part 5 · 待你确认

1. **Part 1 全链路字段流**：这是不是你想要的"真实思考全链路"？有没有我漏读的节点？
2. **Part 2 逐节点改造清单**：6 个改造点（A-F）是否覆盖了你心里"到底要动哪些链路"？哪个点你觉得方向不对？
3. **Part 4 试验画像**：这版"真正交织"是否达标？还是仍嫌单薄？如果达标，我据此定 dossier 的 `integratedSynthesis` 字段形态。
4. **理论卡真源**（改造点 E）：报告 15 张 vs 现 20 张，保持卡名不重命名但补 rich fields——这个折中可接受吗？
5. **实施顺序**：Phase B（A1/A2/A3/A4 低风险）先行，Phase C（B/E 核心重构）等 Part 4 形态确认后再动——同意吗？

不改代码，等你反馈。
