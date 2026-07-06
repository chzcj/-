import { ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { deepModelDigestHasContent, pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { getJobHealth } from '@/lib/server/jobs/queue'

/** 四模块生成页轮询：深度建模 digest 是否就绪 */
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()

  let digest = await loadDeepModelDigest(tenant).catch(() => null)
  if (!digest || !deepModelDigestHasContent(pickDeepModelDigestPack(digest))) {
    digest = await buildDeepModelDigest(tenant).catch(() => digest)
  }

  const pack = pickDeepModelDigestPack(digest)
  const health = await getJobHealth(tenant).catch(() => undefined)
  const dmJobs = health?.byType?.deep_mechanism_review || {}
  const mechanismReviewSucceeded = (dmJobs.succeeded ?? 0) > 0
  const mechanismReviewPending =
    (dmJobs.pending ?? 0) + (dmJobs.running ?? 0) + (dmJobs.retrying ?? 0) > 0

  const digestReady = deepModelDigestHasContent(pack)
  const mechanismReviewReady =
    mechanismReviewSucceeded || (digestReady && !mechanismReviewPending)
  const structuralTensionsCount = digest?.structuralTensions?.length ?? 0

  return ok({
    digestReady,
    mechanismReviewReady,
    mechanismReviewSucceeded,
    mechanismReviewPending,
    structuralTensionsCount,
    structuralTensionsReady: structuralTensionsCount > 0 || digestReady,
    mechanismNarrative: Boolean(pack.mechanismNarrative),
    mechanismNarrativeChars: pack.mechanismNarrative.replace(/\s/g, '').length,
    digestSource: digest?.source || null,
    anchoredFactCount: pack.anchoredFacts.length,
    updatedAt: digest?.updatedAt || null,
  })
}
