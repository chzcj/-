import { ok, failFromError } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { getBuildProgress, saveBuildProgress, type RemoteBuildState } from '@/lib/server/memory/database-manager'
import { resolveTenant } from '@/lib/server/memory/tenant'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const state = await getBuildProgress(tenant).catch(() => null)
  return ok({ state })
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const tenant = await resolveTenant()
    const completedEntries = Array.isArray(body?.completedEntries)
      ? body.completedEntries.map(String).filter(Boolean)
      : []
    const state: RemoteBuildState = {
      introSeen: Boolean(body?.introSeen),
      basicInfoDone: Boolean(body?.basicInfoDone),
      completedEntries,
      stageSummaries: Array.isArray(body?.stageSummaries)
        ? body.stageSummaries
            .filter((s: unknown) => Boolean(s) && typeof (s as { entryType?: unknown }).entryType === 'string')
            .slice(0, 8)
            .map((s: {
              entryType?: string
              mainJudgment?: string
              facts?: string[]
              pendingHypotheses?: string[]
              note?: string
              familyMap?: string
              sufficient?: boolean
            }) => ({
              entryType: String(s.entryType || ''),
              mainJudgment: String(s.mainJudgment || ''),
              facts: Array.isArray(s.facts) ? s.facts.map(String).slice(0, 12) : [],
              pendingHypotheses: Array.isArray(s.pendingHypotheses)
                ? s.pendingHypotheses.map(String).slice(0, 12)
                : [],
              note: typeof s.note === 'string' ? s.note : undefined,
              familyMap: typeof s.familyMap === 'string' ? s.familyMap : undefined,
              sufficient: typeof s.sufficient === 'boolean' ? s.sufficient : undefined,
            }))
        : [],
      updatedAt: new Date().toISOString(),
    }
    await saveBuildProgress(state, tenant)

    return ok({ saved: true, state })
  } catch (error) {
    return failFromError(error)
  }
}
