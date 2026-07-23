import { agentPrompts } from '@/lib/server/agent-prompts'
import { requireFastJson } from '@/lib/server/daily/llm-required'
import { frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import {
  buildDialogueAnalysisViewModel,
  flattenPhaseSegments,
  normalizeDialogueAnalysisV2,
  normalizeSegments,
  serializeSampleDialogue,
  serializeTryTonight,
  type DialogueAnalysisLlmV2,
} from '@/lib/server/rehearsal/dialogue-analysis-v2'
import type { DialogueAnalysisV2 } from '@yujian/contracts/rehearsal-dialogue'

export type RunDialogueAnalysisResult =
  | { kind: 'insufficient'; friendlyMessage: string; transcript: string }
  | {
      kind: 'done'
      summary: string
      analysis: string
      tryTonight: string
      sampleDialogue: string
      segments: ReturnType<typeof normalizeSegments>
      v2: DialogueAnalysisV2
      rehearsalSeed: Record<string, unknown>
    }

export async function runDialogueAnalysis(params: {
  transcript: string
  digest: DeepModelDigest | null
  analysisId: string
}): Promise<RunDialogueAnalysisResult> {
  const { transcript, digest, analysisId } = params
  const digestPack = pickDeepModelDigestPack(digest)

  const system = [
    agentPrompts.parentFacingStyle,
    '---',
    agentPrompts.deepModelingParentDigest,
    '---',
    agentPrompts.dialogueAnalysisV2,
  ].join('\n\n')

  const result = await requireFastJson<DialogueAnalysisLlmV2>(
    system,
    {
      task:
        '分析亲子对话转写（V2-F）。先做有效性门控。有效时输出 synthesis/dossierCells/phases/tryTonightSteps/sampleLines/rehearsalSeed 等 JSON，见 system。',
      transcript,
      deepModelDigest: digestPack,
    },
    { maxTokens: 2200, disableThinking: frontAiThinkingDisabled() }
  )

  if (result.insufficient) {
    return {
      kind: 'insufficient',
      friendlyMessage:
        result.friendlyMessage?.trim() ||
        '这段录音里没有听到有效的亲子对话，下次真实交流时再录一段就好。',
      transcript,
    }
  }

  const v2 = normalizeDialogueAnalysisV2(result, result.summary || '')
  const segments = flattenPhaseSegments(v2)
  const tryTonight = serializeTryTonight(v2.tryTonightSteps)
  const sampleDialogue = serializeSampleDialogue(v2.sampleLines)

  const rehearsalSeed = {
    sceneTitle: result.rehearsalSeed?.sceneTitle || result.summary || '根据刚才的真实对话',
    sceneSummary: result.rehearsalSeed?.sceneSummary || result.summary || v2.synthesis.slice(0, 120),
    openingHint: result.rehearsalSeed?.openingHint || '',
    dialogueHighlights: segments.filter((s) => s.highlight).slice(0, 5),
    tryTonight,
    sampleDialogue,
    sourceAnalysisId: analysisId,
    v2,
  }

  return {
    kind: 'done',
    summary: result.summary || v2.synthesis.slice(0, 60),
    analysis: v2.synthesis,
    tryTonight,
    sampleDialogue,
    segments,
    v2,
    rehearsalSeed,
  }
}

/** GET 响应：旧记录无 v2 时现场适配 */
export function enrichDialogueAnalysisRow(row: {
  summary: string
  analysis: string
  tryTonight: string
  sampleDialogue: string
  segments: Array<{ speaker: string; text: string; highlight?: boolean; highlightReason?: string }>
  rehearsalSeed?: Record<string, unknown>
}) {
  const v2 = buildDialogueAnalysisViewModel(row)
  return { v2, segments: row.segments?.length ? row.segments : flattenPhaseSegments(v2) }
}
