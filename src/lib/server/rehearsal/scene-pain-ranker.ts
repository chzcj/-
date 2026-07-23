/**
 * 预演痛点 Top5：纯规则计频（非 LLM）。
 * mentionCountHint 必须由此产出，禁止 hydrator 编造次数。
 * （纯函数，可被 scripts 单测；无 DB / 无密钥）
 */

export type PainClusterId =
  | 'homework_start'
  | 'after_conflict'
  | 'phone'
  | 'morning'
  | 'grades'
  | 'dynamic'

export type PainTurnInput = {
  text: string
  createdAt?: string
  mode?: string
}

export type PainClusterScore = {
  id: PainClusterId
  label: string
  n14: number
  n90: number
  score: number
  samples: string[]
  mentionCountHint: string
  /** v4 动态场景：LLM 归类的家长可读场景描述 */
  dynamicSummary?: string
}

const CLUSTERS: Array<{ id: PainClusterId; label: string; re: RegExp }> = [
  { id: 'homework_start', label: '作业启动', re: /作业|写作业|催.*写|不写|拖着|磨蹭|启动/ },
  { id: 'after_conflict', label: '吵完修复', re: /吵|顶嘴|说重了|冷战|不理|关门|回房/ },
  { id: 'phone', label: '手机规则', re: /手机|平板|游戏|刷视频|收走/ },
  { id: 'morning', label: '早上出门', re: /起床|出门|迟到|早上|早饭/ },
  { id: 'grades', label: '成绩沟通', re: /成绩|分数|考试|卷子|排名/ },
]

/** 扩展 seed：UI 尚无独立卡时，用同构字段补到 Top5 */
export const EXTENDED_SCENE_SEEDS: Record<
  PainClusterId,
  { title: string; subtitle: string; summary: string; seed: string; openingHint: string; openingChild: string }
> = {
  homework_start: {
    title: '写作业前怎么开口',
    subtitle: '他拖着不开始，你一催就容易吵起来。',
    summary: '孩子拖着不开始写作业，一催就容易吵。想练一句更容易让他动手的开口。',
    seed: '写作业前怎么开口',
    openingHint: '他可能先听到「你又要催我」，而不是「我们一起把今晚安排清楚」。',
    openingChild: '你别催我行不行，我又不是不写。',
  },
  after_conflict: {
    title: '刚吵完怎么修复',
    subtitle: '刚才说重了，想重新开口，但怕越说越糟。',
    summary: '刚吵完一轮，气氛还僵，想重新开口又怕再吵。',
    seed: '刚吵完怎么修复',
    openingHint: '刚吵完时，他更需要先感到对话不会马上变成批评。',
    openingChild: '你别说了，我不想听。',
  },
  phone: {
    title: '手机规则怎么谈',
    subtitle: '一提手机就炸，想谈规则，又不想变成争吵。',
    summary: '一提手机规则就容易炸，想谈边界又不想再吵。',
    seed: '手机规则怎么谈',
    openingHint: '他可能先听到「你又要收走」，而不是「我们在谈一个公平约定」。',
    openingChild: '就再看一会儿嘛，你每次都这样。',
  },
  morning: {
    title: '早上出门怎么催',
    subtitle: '起床出门总卡，想催又不想一早上就吵。',
    summary: '早上起床出门总拖，你担心迟到，一催气氛就紧。',
    seed: '早上出门怎么催',
    openingHint: '他可能先感到时间压力，而不是你在帮他顺利出门。',
    openingChild: '再睡五分钟……你别一直催。',
  },
  grades: {
    title: '成绩出来怎么谈',
    subtitle: '想问成绩又怕一开口就变成质问。',
    summary: '成绩或考试刚出，你想了解情况，又怕一开口变成质问。',
    seed: '成绩出来怎么谈',
    openingHint: '他可能先防着评价，而不是听到你在关心哪里卡住了。',
    openingChild: '考成这样又怎样……你别问了。',
  },
  dynamic: {
    title: '其他高频场景',
    subtitle: '从你的交流里发现的一些反复出现的场景。',
    summary: '从交流记录里发现的一些反复出现但不在常规分类里的场景，点进去看看。',
    seed: '其他高频场景',
    openingHint: '先看看这个场景下，你们通常怎么开始的。',
    openingChild: '又来了……',
  },
}

function ageMs(createdAt?: string, now = Date.now()): number {
  if (!createdAt) return 90 * 864e5
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return 90 * 864e5
  return Math.max(0, now - t)
}

function hintFor(n14: number, n90: number): string {
  if (n14 >= 2) return `近2周 · 提过${n14}次`
  if (n90 >= 2) return `近期提过${n90}次`
  if (n90 >= 1 || n14 >= 1) return '近期提过'
  return ''
}

/**
 * 从 turn 文本计频；score = n14*2 + n90。
 * 忽略纯预演开场模板噪声时可过滤 mode=rehearsal（可选）。
 */
export function rankPainClusters(
  turns: PainTurnInput[],
  opts?: { now?: number; excludeRehearsalMode?: boolean; topN?: number }
): PainClusterScore[] {
  const now = opts?.now ?? Date.now()
  const topN = opts?.topN ?? 5
  const d14 = 14 * 864e5
  const d90 = 90 * 864e5

  const buckets = Object.fromEntries(
    CLUSTERS.map((c) => [
      c.id,
      { id: c.id, label: c.label, n14: 0, n90: 0, samples: [] as string[] },
    ])
  ) as Record<PainClusterId, { id: PainClusterId; label: string; n14: number; n90: number; samples: string[] }>

  for (const turn of turns) {
    if (opts?.excludeRehearsalMode && (turn.mode || '').includes('rehearsal')) continue
    const msg = (turn.text || '').trim()
    if (msg.length < 4) continue
    // 预演系统套话不当痛点证据
    if (msg.startsWith('【预演场景')) continue
    const age = ageMs(turn.createdAt, now)
    for (const c of CLUSTERS) {
      if (!c.re.test(msg)) continue
      const b = buckets[c.id]
      if (age <= d90) b.n90++
      if (age <= d14) b.n14++
      if (b.samples.length < 3) b.samples.push(msg.slice(0, 120))
    }
  }

  const ranked = CLUSTERS.map((c) => {
    const b = buckets[c.id]
    const score = b.n14 * 2 + b.n90
    return {
      id: c.id,
      label: c.label,
      n14: b.n14,
      n90: b.n90,
      score,
      samples: b.samples,
      mentionCountHint: hintFor(b.n14, b.n90),
    } satisfies PainClusterScore
  }).sort((a, b) => b.score - a.score || b.n14 - a.n14)

  const withSignal = ranked.filter((r) => r.score > 0)
  if (withSignal.length >= topN) return withSignal.slice(0, topN)

  // 不足 TopN：保留有信号的，再按默认顺序补 seed（不写假频次）
  const picked: PainClusterScore[] = [...withSignal]
  for (const c of CLUSTERS) {
    if (picked.length >= topN) break
    if (picked.some((p) => p.id === c.id)) continue
    picked.push({
      id: c.id,
      label: c.label,
      n14: 0,
      n90: 0,
      score: 0,
      samples: [],
      mentionCountHint: '',
    })
  }

  // v4：收集未匹配到固定 cluster 的 turn（可能是家庭特有冲突点）
  const unmatched: string[] = []
  for (const turn of turns) {
    if (opts?.excludeRehearsalMode && (turn.mode || '').includes('rehearsal')) continue
    const msg = (turn.text || '').trim()
    if (msg.length < 8) continue
    if (msg.startsWith('【预演场景')) continue
    const matched = CLUSTERS.some(c => c.re.test(msg))
    if (!matched) unmatched.push(msg.slice(0, 120))
  }

  // 如果有 ≥5 条未匹配的 turn，附加一个 dynamic 场景占位（LLM 在 hydrator 阶段归类）
  if (unmatched.length >= 5 && picked.length < topN + 2) {
    picked.push({
      id: 'dynamic' as PainClusterId,
      label: '其他高频场景',
      n14: unmatched.length,
      n90: unmatched.length,
      score: unmatched.length,
      samples: unmatched.slice(0, 5),
      mentionCountHint: hintFor(unmatched.length, unmatched.length),
      dynamicSummary: '从你的交流记录里发现了一些反复出现但不在常规分类里的场景，点进去看看',
    })
  }

  return picked.slice(0, topN)
}

export function buildMentionCountHint(score: Pick<PainClusterScore, 'n14' | 'n90'>): string {
  return hintFor(score.n14, score.n90)
}
