import type {
  RawMaterial,
  CleanedFact,
  EntryEvidencePack,
  RetrievalIndex,
  EvidenceStrength,
  DailyInteractionUpdate
} from '@/types/database'
import type { TenantId } from './tenant'

/* ================================================================
   Index Tag Engine — 四维标签引擎（场景/机制/证据/时间）
   ================================================================ */

const SCENE_TAGS = [
  '作业拖延', '手机冲突', '一说学习就吵', '考试失利',
  '背诵抗拒', '错题订正', '收手机', '睡前手机',
  '不说学校', '表面答应', '撒谎/隐瞒进度', '家长检查',
  '加任务', '家长讲道理', '被催写作业', '关门/走开',
  '顶嘴', '哭泣', '自我否定', '家长失望表达'
]

const MECHANISM_TAGS = [
  '任务无结束感', '表面配合—实际撤退', '暴露不会恐惧',
  '手机恢复出口', '可控时间争夺', '追问—沉默循环',
  '检查—暴露—回避循环', '付出—期待—愧疚循环',
  '家长式帮助失效', '失败退路保护', '能力断层',
  '睡眠精力不足', '学校压力放大', '愧疚型配合',
  '努力无效感', '自主选择感缺失'
]

const TIME_TAGS = [
  '首次五入口', '最近7天', '最近30天',
  '本周变化', '长期稳定', '突然变化', '旧模式重复'
]

function sceneTagsFromText(text: string): string[] {
  const tags: string[] = []
  const t = (text || '').toLowerCase()
  if (t.includes('作业') || t.includes('写') || t.includes('拖')) tags.push('作业拖延')
  if (t.includes('手机') || t.includes('玩')) tags.push('手机冲突')
  if (t.includes('检查') || t.includes('看')) tags.push('家长检查')
  if (t.includes('背') || t.includes('默写')) tags.push('背诵抗拒')
  if (t.includes('说知道') || t.includes('答应') || t.includes('马上')) tags.push('表面答应')
  if (t.includes('撒谎') || t.includes('骗') || t.includes('没写')) tags.push('撒谎/隐瞒进度')
  if (t.includes('加') || t.includes('继续') || t.includes('还有')) tags.push('加任务')
  if (t.includes('烦') || t.includes('吵') || t.includes('顶嘴')) tags.push('顶嘴')
  if (t.includes('关') || t.includes('走开') || t.includes('回房间')) tags.push('关门/走开')
  if (t.includes('考') || t.includes('成绩') || t.includes('分数')) tags.push('考试失利')
  if (t.includes('无') || t.includes('随便') || t.includes('摆烂')) tags.push('失败退路保护')
  return tags
}

export function autoTagMaterial(material: RawMaterial): string[] {
  return sceneTagsFromText(material.rawText || '')
}

// 检索时从家长本轮 query 提取标签，用于向量检索前的标签软过滤（OR）。
export function autoTagQuery(query: string): { sceneTags: string[]; mechanismTags: string[] } {
  return { sceneTags: sceneTagsFromText(query), mechanismTags: [] }
}

export function buildRetrievalIndex(
  linkedItemId: string,
  linkedItemLayer: string,
  sceneTags: string[],
  mechanismTags: string[],
  evidenceStrength: EvidenceStrength,
  timeTags: string[],
  tenant: TenantId
): RetrievalIndex {
  return {
    indexId: `idx_${linkedItemLayer}_${linkedItemId}`,
    familyId: tenant.familyId,
    childId: tenant.childId,
    linkedItemId,
    linkedItemLayer,
    sceneTags,
    mechanismTags,
    evidenceStrengthTag: evidenceStrength,
    timeTags,
    createdAt: new Date().toISOString()
  }
}

export function buildIndexesForMaterial(material: RawMaterial, tenant: TenantId): RetrievalIndex {
  const sceneTags = autoTagMaterial(material)
  return buildRetrievalIndex(
    material.materialId,
    'raw_material',
    sceneTags,
    [],
    'medium',
    [new Date(material.createdAt).getTime() > Date.now() - 7 * 86400000 ? '最近7天' : '最近30天'],
    tenant
  )
}

export function buildIndexesForEvidencePack(pack: EntryEvidencePack, tenant: TenantId): RetrievalIndex {
  const mechanismTags = pack.candidateMechanisms.map(m => m.mechanismName)
  return buildRetrievalIndex(
    pack.packId,
    'entry_evidence_pack',
    pack.decomposedInput.verifiableFacts.slice(0, 3),
    mechanismTags,
    'medium',
    ['首次五入口'],
    tenant
  )
}

export function buildIndexesForDailyUpdate(update: DailyInteractionUpdate, tenant: TenantId): RetrievalIndex {
  return buildRetrievalIndex(
    update.updateId,
    'daily_interaction_update',
    [],
    update.matchedMechanisms,
    'medium',
    ['最近7天'],
    tenant
  )
}

export function getAllSceneTags(): string[] { return SCENE_TAGS }
export function getAllMechanismTags(): string[] { return MECHANISM_TAGS }
export function getAllTimeTags(): string[] { return TIME_TAGS }
