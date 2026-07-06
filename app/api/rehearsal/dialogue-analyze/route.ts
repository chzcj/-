import { fail, ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { requireFastJson } from '@/lib/server/daily/llm-required'
import { agentPrompts } from '@/lib/server/agent-prompts'

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const transcript = String(body.transcript || '').trim()
    if (transcript.length < 10) {
      return fail('BAD_REQUEST', '对话内容太短，请多录几句原话。', undefined, 400)
    }

    const tenant = await resolveTenant()
    let digest = await loadDeepModelDigest(tenant).catch(() => null)
    if (!digest?.mechanismNarrative) {
      digest = await buildDeepModelDigest(tenant).catch(() => digest)
    }
    const digestPack = pickDeepModelDigestPack(digest)

    const system = `${agentPrompts.parentFacingStyle}\n\n---\n\n${agentPrompts.deepModelingParentDigest}`
    const result = await requireFastJson<{
      segments: Array<{ speaker: string; text: string; highlight?: boolean; highlightReason?: string }>
      analysis: string
      tryTonight?: string
    }>(
      system,
      {
        task: '分析亲子对话转写，标出 2-5 句值得家长留意的原话（highlight:true），并给出闭环机制解读。只输出 JSON：{ segments, analysis, tryTonight }',
        transcript,
        deepModelDigest: digestPack,
      },
      { maxTokens: 1200 }
    )

    return ok(result)
  } catch (error) {
    return failFromError(error)
  }
}
