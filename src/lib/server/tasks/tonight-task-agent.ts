import 'server-only'

import { callAgentJson } from '@/lib/server/ark-agents'
import { getUserTasks, saveUserTasks } from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'
import { buildDailyDialogueRetrievalPacket } from '@/lib/server/memory/retrieval/router'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'

const TASK_TITLE_BANNED =
  /模式能对上|标记为|观察记录|当前输入|已有画像|写入记忆|判断有更新|待验证|今晚试一下|今晚可以试一次|今晚先试一次/i

function sanitizeGeneratedTitle(raw: unknown, seedTitle: string): string {
  const seedRaw = seedTitle.trim().replace(TASK_TITLE_BANNED, '').trim()
  const seed = seedRaw.slice(0, 40) || '到点只说一句开始然后等'
  if (typeof raw !== 'string') return seed
  let title = raw.trim().replace(/^["「]|["」]$/g, '')
  title = title.replace(/今晚可以试一次[：:]?/g, '').replace(/今晚试一下[：:]?/g, '').trim()
  title = title.slice(0, 48)
  if (title.length < 8 || TASK_TITLE_BANNED.test(title)) return seed.slice(0, 48)
  return title
}

function fallbackFromExcerpt(replyExcerpt: string | undefined, seedTitle: string) {
  const chunks = (replyExcerpt || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-•·\d.)]+\s*/, '').trim())
    .filter((line) => line.length > 8)
  if (!chunks.length) return {}
  const actionHint = chunks.find((line) => /别|不要|只问|只说|先|停|不要先/.test(line))?.slice(0, 72)
  const rationale =
    chunks.find((line) => line.length >= 24 && !/家长|孩子/.test(line.slice(0, 4)))?.slice(0, 280) ||
    chunks.find((line) => line.length >= 20)?.slice(0, 280)
  void seedTitle
  return {
    actionHint,
    rationale,
  }
}

function sanitizeShort(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim().slice(0, max)
  return v.length >= 4 ? v : undefined
}

/** 保存任务后轻度异步：专用 Agent 润色任务包（标题 + 情境 + 意义）。 */
export async function refineTonightTaskInBackground(args: {
  tenant: TenantId
  taskId: string
  seedTitle: string
  observation?: string
  replyExcerpt?: string
}): Promise<void> {
  const [packet, digestLoaded] = await Promise.all([
    buildDailyDialogueRetrievalPacket(args.observation || args.replyExcerpt || args.seedTitle, args.tenant, {
      fast: true,
    }).catch(() => null),
    loadDeepModelDigest(args.tenant).catch(() => null),
  ])
  if (!digestLoaded?.mechanismNarrative) {
    void buildDeepModelDigest(args.tenant).catch(() => undefined)
  }
  const digest = digestLoaded
  const ai = await callAgentJson<{
    title?: string
    sceneLabel?: string
    actionHint?: string
    rationale?: string
  }>(
    'tonightTaskGenerator',
    '生成情境化今晚任务包（title/sceneLabel/actionHint/rationale）。',
    {
      seedTitle: args.seedTitle.slice(0, 60),
      observation: (args.observation || '').slice(0, 120),
      replyExcerpt: (args.replyExcerpt || '').slice(0, 1200),
      deepModelDigest: pickDeepModelDigestPack(digest),
      retrievalPack: packet
        ? {
            entryFacts: (packet as { entryFacts?: string[] }).entryFacts || [],
            matchedMechanisms: packet.matchedMechanisms || [],
            familyPatterns: packet.familyInteractionPatterns || [],
            childQuotes: (packet as { childQuotes?: string[] }).childQuotes || [],
          }
        : undefined,
    },
    { maxTokens: 640 }
  ).catch(() => undefined)

  const fallback = fallbackFromExcerpt(args.replyExcerpt, args.seedTitle)
  const nextTitle = sanitizeGeneratedTitle(ai?.title, args.seedTitle)
  const sceneLabel = sanitizeShort(ai?.sceneLabel, 24) || sanitizeShort(args.observation, 24)
  const actionHint = sanitizeShort(ai?.actionHint, 72) || sanitizeShort(fallback.actionHint, 72)
  const rationale = sanitizeShort(ai?.rationale, 280) || sanitizeShort(fallback.rationale, 280)

  const all = await getUserTasks(args.tenant)
  const idx = all.findIndex((t) => t.taskId === args.taskId)
  if (idx < 0) return

  const prev = all[idx]
  const unchanged =
    prev.title === nextTitle &&
    (prev.sceneLabel || '') === (sceneLabel || '') &&
    (prev.actionHint || '') === (actionHint || '') &&
    (prev.rationale || '') === (rationale || '')
  if (unchanged) return

  all[idx] = {
    ...prev,
    title: nextTitle,
    sceneLabel: sceneLabel || prev.sceneLabel,
    actionHint: actionHint || prev.actionHint,
    rationale: rationale || prev.rationale,
    updatedAt: new Date().toISOString(),
  }
  await saveUserTasks(all, args.tenant)
}
