import { ok, fail, failFromError } from '@/lib/api-response'
import { callFastJson } from '@/lib/server/ark-agents'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { createId } from '@/lib/storage/storageIds'

const TITLE_MAP: Record<string, string> = {
  study: '学习作业', routine: '手机与日常节奏',
  communication: '亲子沟通', emotion: '情绪压力', environment: '关系环境',
  final: '五入口综合',
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json()
    const { entryType, rawText, stage } = body
    if (!entryType || !rawText) {
      return fail('BAD_REQUEST', '缺少 entryType 或 rawText', undefined, 400)
    }

    const topic = TITLE_MAP[entryType] || entryType

    if (stage === 'summary') {
      const result = await callFastJson<{
        mainJudgment: string; facts: string[]; pendingHypotheses: string[]; note: string
      }>(
        `你是 ChildOS 的阶段总结 agent。家长在"${topic}"入口填了一段描述。请你根据这段输入，写一个阶段总结。
要求：mainJudgment 写当前阶段的核心判断（不贴标签，不直接采信家长的评价词如懒/不自觉/沉迷）；facts 提取 2-4 个可验证事实；pendingHypotheses 提 2-3 个候选假设（用"可能"开头）；note 写后续值得继续观察的方向。
只输出 JSON，不输出 Markdown 或解释。`,
        { entryType, rawText }
      ).catch(() => undefined)

      // 入口采集 Episode 抽取入队。episodeId 随机（同入口允许重复提交各成一篇）；
      // key=null 不去重；job 重试用 payload 内固定 episodeId 保证幂等。
      const tenant = await resolveTenant()
      const episodeId = createId('ep')
      void enqueueJob('episode_ingest', {
        text: rawText,
        ctx: { sourceEventId: `entry_${entryType}`, familyId: tenant.familyId, childId: tenant.childId, episodeId }
      }, null, `entry_${entryType}`)

      // EntryEvidencePack(L3) 由后台「入口证据建造 Agent」深度生成（测评反馈：前台只返阶段反馈，证据包后台深拆）。
      // 仅在真有 AI 结果时入队（前台快总结作 hint，深拆/写库在 entry_evidence job 异步完成；LLM 失败 job 内回退规则版）。
      if (result?.mainJudgment && TITLE_MAP[entryType] && entryType !== 'final') {
        void enqueueJob('entry_evidence', {
          entryType,
          rawText,
          frontSummary: result.mainJudgment,
          facts: Array.isArray(result.facts) ? result.facts : [],
          hypotheses: Array.isArray(result.pendingHypotheses) ? result.pendingHypotheses : [],
          tenant,
        }, null, `entry_evd_${entryType}`)
      }

      // 无 AI 结果（无 key / LLM 失败）→ 503 明确告知，而非 ok:true/data 空（前台据此显示重试）。
      if (!result?.mainJudgment) {
        return fail('ENTRY_SUMMARY_UNAVAILABLE', '这一步暂时没有整理成功，可以稍后再试。', undefined, 503)
      }
      return ok(result)
    }

    const followUp = await callFastJson<{
      shouldAsk: boolean; purpose: string; directions: string[]; voicePrompt: string
    }>(
      `你是 ChildOS 的入口追问 agent。家长在"${topic}"入口输入了一段描述。根据这段描述生成一个追问。
要求：purpose 一句话说明追问的精确目的（帮家长把现场看得更具体）；directions 给 3-4 个候选思考方向（短标签）；voicePrompt 给一句口语化的追问提示（像面谈老师在问）。
只输出 JSON，不输出 Markdown 或解释。`,
      { entryType, rawText }
    ).catch(() => undefined)

    if (!followUp?.purpose) {
      return fail('ENTRY_FOLLOWUP_UNAVAILABLE', '这一步暂时没有整理成功，可以稍后再试。', undefined, 503)
    }
    return ok(followUp)
  } catch (error) {
    return failFromError(error)
  }
}
