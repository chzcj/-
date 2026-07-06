import { ok, fail, failFromError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/server/auth'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { saveBuiltProfileSnapshot, getLatestBuiltProfileSnapshot, type BuiltProfileSnapshot } from '@/lib/server/memory/database-manager'
import { humanizeBuiltJudgment } from '@/lib/server/daily/profile-sanitize'
import { setUserOnboardingComplete } from '@/lib/server/db'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { enqueueJob } from '@/lib/server/jobs/queue'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'

/* ================================================================
   首次建模孩子画像快照的 DB 持久化（让画像跨设备/重装不丢）。
   POST：generating 生成后写入；GET：home/result 跨设备读取。按租户隔离。
   ================================================================ */

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const user = await getCurrentUser()
  const snapshot = await getLatestBuiltProfileSnapshot(tenant).catch(() => null)
  const humanized = snapshot
    ? {
        ...snapshot,
        coreJudgment: humanizeBuiltJudgment(snapshot.coreJudgment, {
          deepMechanism: snapshot.deepMechanism,
          supportFocus: snapshot.supportFocus,
        }),
      }
    : null
  const onboardingComplete = Boolean(user?.onboardingComplete) || Boolean(humanized?.coreJudgment?.trim())
  return ok({ snapshot: humanized, onboardingComplete })
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const s = body?.snapshot
    if (!s || typeof s.coreJudgment !== 'string' || !s.coreJudgment.trim()) {
      return fail('BAD_SNAPSHOT', '画像内容不完整，请重新生成。', undefined, 400)
    }
    const tenant = await resolveTenant()
    const user = await getCurrentUser()
    const snapshot: BuiltProfileSnapshot = {
      completeness: typeof s.completeness === 'number' ? s.completeness : 0,
      coreJudgment: humanizeBuiltJudgment(String(s.coreJudgment), {
        deepMechanism: typeof s.deepMechanism === 'string' ? s.deepMechanism : '',
        supportFocus: typeof s.supportFocus === 'string' ? s.supportFocus : undefined,
      }),
      deepMechanism: typeof s.deepMechanism === 'string' ? s.deepMechanism : '',
      supportFocus: typeof s.supportFocus === 'string' ? s.supportFocus : undefined,
      evidence: Array.isArray(s.evidence)
        ? s.evidence
            .filter((e: unknown) => Boolean(e) && typeof (e as { evidenceText?: unknown }).evidenceText === 'string')
            .slice(0, 8)
            .map((e: { sourceLabel?: string; evidenceText?: string; explanation?: string; strength?: string }) => ({
              sourceLabel: String(e.sourceLabel || ''),
              evidenceText: String(e.evidenceText || ''),
              explanation: String(e.explanation || ''),
              strength: (e.strength === 'weak' || e.strength === 'strong') ? e.strength : 'medium',
            }))
        : [],
      verificationPoints: Array.isArray(s.verificationPoints)
        ? s.verificationPoints
            .filter((v: unknown) => Boolean(v) && typeof (v as { title?: unknown }).title === 'string')
            .slice(0, 6)
            .map((v: { title?: string; description?: string }) => ({ title: String(v.title || ''), description: String(v.description || '') }))
        : [],
      updatedAt: new Date().toISOString(),
    }
    await saveBuiltProfileSnapshot(snapshot, tenant)
    const dayBucket = new Date().toISOString().slice(0, 10)
    await enqueueJob(
      'deep_mechanism_review',
      { tenant },
      `deep_mechanism:build:${tenant.familyId}:${tenant.childId}:${dayBucket}`,
      null
    ).catch(() => {})
    void buildDeepModelDigest(tenant)
    if (user?.userId) {
      await setUserOnboardingComplete(user.userId, true)
    }
    return ok({ saved: true, onboardingComplete: true })
  } catch (error) {
    return failFromError(error)
  }
}
