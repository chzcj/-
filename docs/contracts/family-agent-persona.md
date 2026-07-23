# Family Agent Persona 契约（v4）

> 类型定义：`src/types/database.ts` → `FamilyAgentPersona`
> 持久化层：`src/lib/server/memory/family-agent-persona/persona-store.ts`
> 生产 Agent：`prompts/background/personaSynthesizer.md`（AgentPromptKey: `personaSynthesizer`）
> 接入点：`src/lib/server/memory/deep-mechanism/pipeline.ts` → `updateFamilyAgentPersona()`
> 前台消费：`src/lib/server/orchestration/pipeline.ts` → `OrchestrationOutput.familyAgentPersona`
> 前台 SP 消费：`prompts/core/parentFacingStyle.md` §十八 persona 适配

## 层定义

| 属性 | 值 |
|---|---|
| layer_name | `family_agent_persona` |
| item_id | `latest`（单例层，每次更新覆盖） |
| 写入方式 | `upsertMemoryLayerItems`（幂等覆盖） |
| 读取方式 | `loadMemoryLayerItemById` |
| TTL | 无（每次 deep_mechanism_review 后增量更新） |

## FamilyAgentPersona 类型

```typescript
export type FamilyAgentPersona = {
  familyId: string

  parentTraits: {
    anxietyLevel: number       // 0-1，家长焦虑水平
    controlTendency: number    // 0-1，控制倾向
    reflectivity: number       // 0-1，反思能力
  }

  childTraits: {
    ageStage: string           // 学龄前|小学低年级|小学高年级|初中|高中
    temperament: string        // 趋避|适应慢|情绪敏感|活跃冲动|安静专注
  }

  familyClimate: {
    conflictFrequency: number  // 0-1，冲突频率
    supportLevel: number       // 0-1，支持水平
  }

  toneCalibration: 'gentle' | 'direct' | 'analytical'
  questionStrategy: 'probe_feeling' | 'probe_behavior' | 'probe_context'

  updatedAt: string            // ISO 时间戳
  version: number              // 每次更新 +1
}
```

## 生成/更新时机

| 触发条件 | 说明 |
|---|---|
| deep_mechanism_review job 完成后 | `updateFamilyAgentPersona()` 在 pipeline 末尾调用，失败不阻断主流程 |
| 首次生成 | `currentPersona=null` → personaSynthesizer 用判定值直接生成 |
| 增量更新 | `currentPersona` 非空 → 平滑公式：新值 = 0.6×旧值 + 0.4×新判定值 |

## personaSynthesizer Agent 输入

```json
{
  "familyId": "家庭ID",
  "currentPersona": { ... } | null,
  "dossier": { ... } | null,
  "parentInputHistory": ["近10轮家长原话"]
}
```

## personaSynthesizer Agent 输出

```json
{
  "parentTraits": { "anxietyLevel": 0.7, "controlTendency": 0.6, "reflectivity": 0.4 },
  "childTraits": { "ageStage": "初中", "temperament": "情绪敏感" },
  "familyClimate": { "conflictFrequency": 0.5, "supportLevel": 0.4 },
  "toneCalibration": "gentle",
  "questionStrategy": "probe_feeling"
}
```

## 前台消费链路

```
orchestration/pipeline.ts
  → loadFamilyAgentPersona(tenant)
  → OrchestrationOutput.familyAgentPersona
  → prose-context.ts buildDailyProsePayload
  → user payload 里的 familyAgentPersona 字段
  → parentFacingStyle §十八 persona 适配
```

## persona 适配规则（parentFacingStyle §十八）

| persona 字段 | 值 | 前台效果 |
|---|---|---|
| anxietyLevel | 高 | 更敏感于焦虑信号，先接情绪再分析 |
| controlTendency | 高 | 更警觉于控制循环，但措辞更柔和 |
| reflectivity | 高 | 提问更深，给更多分析空间 |
| reflectivity | 低 | 直接给建议，少分析 |
| toneCalibration | gentle | 语气温和，多用「可能」「也许」 |
| toneCalibration | direct | 直接给判断，少绕弯 |
| toneCalibration | analytical | 多给逻辑链条，但仍是人话 |

## 硬规则

- persona 只调**关注点敏感度**和**语言温度**，**不改变**事实锚定/替代解释/把握度/认识论隔离/反套模板/非归罪这些硬规则
- 禁止 persona 里出现对孩子的病理化标签（如「ADHD」「焦虑症」）
- 禁止 persona 里出现对家长的人格化标签（如「控制型母亲」）
- persona 数值是连续的（0-1），不是离散标签
- 平滑更新避免 persona 剧烈跳变（0.6×旧+0.4×新）

## 默认值（buildDefaultPersona）

```typescript
{
  parentTraits: { anxietyLevel: 0.5, controlTendency: 0.5, reflectivity: 0.5 },
  childTraits: { ageStage: 'unknown', temperament: 'unknown' },
  familyClimate: { conflictFrequency: 0.3, supportLevel: 0.5 },
  toneCalibration: 'gentle',
  questionStrategy: 'probe_feeling',
  version: 1
}
```

## 与其他层的关系

| 关联层 | 关系 |
|---|---|
| `deep_model_digest` | persona 在 deep_mechanism_review 后生成，与 digest 同周期 |
| `pending_hypotheses` | persona 不直接读写假设池，但 questionStrategy 影响前台追问策略 |
| `parent_narrative_patterns` | persona 的 parentTraits 从 parentNarrativePattern 提取信号 |
| `built_profile_snapshots` | persona 不写 profile，但 childTraits 参考 profile 的年龄信息 |

## 生命周期

1. **首次**：deep_mechanism_review 成功 → personaSynthesizer 生成 v1
2. **增量**：每轮 deep_mechanism_review → personaSynthesizer 增量更新（0.6×旧+0.4×新）
3. **前台读取**：每轮 daily dialogue → orchestration pipeline 读取 latest persona → 注入 prose payload
4. **不删除**：persona 只更新不删除，version 持续递增
