import type {
  RawMaterial,
  CleanedFact,
  EntryEvidencePack,
  RetrievalIndex,
  EvidenceStrength,
  DailyInteractionUpdate
} from '@/types/database'
import { createId } from '@/lib/storage/storageIds'

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

export function autoTagMaterial(material: RawMaterial): string[] {
  const tags: string[] = []
  const text = (material.rawText || '').toLowerCase()
  if (text.includes('作业') || text.includes('写') || text.includes('拖')) tags.push('作业拖延')
  if (text.includes('手机') || text.includes('玩')) tags.push('手机冲突')
  if (text.includes('检查') || text.includes('看')) tags.push('家长检查')
  if (text.includes('背') || text.includes('默写')) tags.push('背诵抗拒')
  if (text.includes('说知道') || text.includes('答应') || text.includes('马上')) tags.push('表面答应')
  if (text.includes('撒谎') || text.includes('骗') || text.includes('没写')) tags.push('撒谎/隐瞒进度')
  if (text.includes('加') || text.includes('继续') || text.includes('还有')) tags.push('加任务')
  if (text.includes('烦') || text.includes('吵') || text.includes('顶嘴')) tags.push('顶嘴')
  if (text.includes('关') || text.includes('走开') || text.includes('回房间')) tags.push('关门/走开')
  if (text.includes('考') || text.includes('成绩') || text.includes('分数')) tags.push('考试失利')
  if (text.includes('无') || text.includes('随便') || text.includes('摆烂')) tags.push('失败退路保护')
  return tags
}

export function buildRetrievalIndex(
  linkedItemId: string,
  linkedItemLayer: string,
  sceneTags: string[],
  mechanismTags: string[],
  evidenceStrength: EvidenceStrength,
  timeTags: string[]
): RetrievalIndex {
  return {
    indexId: createId('idx'),
    familyId: 'family_demo',
    childId: 'child_demo',
    linkedItemId,
    linkedItemLayer,
    sceneTags,
    mechanismTags,
    evidenceStrengthTag: evidenceStrength,
    timeTags,
    createdAt: new Date().toISOString()
  }
}

export function buildIndexesForMaterial(material: RawMaterial): RetrievalIndex {
  const sceneTags = autoTagMaterial(material)
  return buildRetrievalIndex(
    material.materialId,
    'raw_material',
    sceneTags,
    [],
    'medium',
    [new Date(material.createdAt).getTime() > Date.now() - 7 * 86400000 ? '最近7天' : '最近30天']
  )
}

export function buildIndexesForEvidencePack(pack: EntryEvidencePack): RetrievalIndex {
  const mechanismTags = pack.candidateMechanisms.map(m => m.mechanismName)
  return buildRetrievalIndex(
    pack.packId,
    'entry_evidence_pack',
    pack.decomposedInput.verifiableFacts.slice(0, 3),
    mechanismTags,
    'medium',
    ['首次五入口']
  )
}

export function buildIndexesForDailyUpdate(update: DailyInteractionUpdate): RetrievalIndex {
  return buildRetrievalIndex(
    update.updateId,
    'daily_interaction_update',
    [],
    update.matchedMechanisms,
    'medium',
    ['最近7天']
  )
}

export function getAllSceneTags(): string[] { return SCENE_TAGS }
export function getAllMechanismTags(): string[] { return MECHANISM_TAGS }
export function getAllTimeTags(): string[] { return TIME_TAGS }
