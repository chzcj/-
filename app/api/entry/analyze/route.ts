import { ok, fail, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { fastAiFailureMessage, runEntryFollowUp, runEntrySummary } from '@/lib/server/entry-analyze'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline'

const TITLE_MAP: Record<string, string> = {
  daily: '日常节奏',
  homework: '学习作业',
  communication: '亲子沟通',
  family: '家庭支持',
  study: '学习作业',
  routine: '日常节奏',
  emotion: '亲子沟通',
  environment: '家庭支持',
  final: '四模块综合',
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const body = await request.json()
    const { entryType, rawText, stage } = body
    if (!entryType || !rawText) {
      return fail('BAD_REQUEST', '内容暂时没有收到，请返回重新录入。', undefined, 400)
    }

    if (stage === 'summary') {
      const { result, error } = await runEntrySummary(entryType, rawText)

      const tenant = await resolveTenant()
      // episodeId 确定派生（tenant + sha(rawText)）：同用户同文本重做 → upsert 同一行 + idem 去重；
      // 不同用户/不同文本 → 各自 episodeId，不再因 idem key 不带 tenant 而被多租户互相吞掉。
      const episodeId = deriveEpisodeId(rawText, {
        familyId: tenant.familyId,
        childId: tenant.childId,
        sourceEventId: `entry_${entryType}`,
      })
      void enqueueJob('episode_ingest', {
        text: rawText,
        ctx: { sourceEventId: `entry_${entryType}`, familyId: tenant.familyId, childId: tenant.childId, episodeId }
      }, episodeId, `entry_${entryType}`)

      if (result?.mainJudgment && TITLE_MAP[entryType] && entryType !== 'final') {
        // 恢复：总是入队 entry_evidence 后台深度拆解（撤销此前 facts≥2 跳过逻辑）。
        // 四模块是一次性建档，质量优先；entry_evidence 提供 cross-entry 综合所需的结构化证据包。
        void enqueueJob('entry_evidence', {
          entryType,
          rawText,
          frontSummary: result.mainJudgment,
          facts: Array.isArray(result.facts) ? result.facts : [],
          hypotheses: Array.isArray(result.pendingHypotheses) ? result.pendingHypotheses : [],
          tenant,
        }, `entry_evd_${tenant.familyId}_${tenant.childId}_${episodeId}`, `entry_${entryType}`)
      }

      if (!result?.mainJudgment) {
        const message = fastAiFailureMessage(error)
        console.error('[entry/analyze] summary failed', { entryType, error })
        return fail('ENTRY_SUMMARY_UNAVAILABLE', message, undefined, 503)
      }
      return ok(result)
    }

    const { result, error } = await runEntryFollowUp(entryType, rawText)
    if (!result || (result.shouldAsk !== false && !result.purpose)) {
      const message = fastAiFailureMessage(error)
      console.error('[entry/analyze] followUp failed', { entryType, error })
      return fail('ENTRY_FOLLOWUP_UNAVAILABLE', message, undefined, 503)
    }
    return ok(result)
  } catch (error) {
    return failFromError(error)
  }
}
