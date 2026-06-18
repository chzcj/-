import { NextResponse } from 'next/server'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { saveBuiltProfileSnapshot, getLatestBuiltProfileSnapshot, type BuiltProfileSnapshot } from '@/lib/server/memory/database-manager'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'

/* ================================================================
   首次建模孩子画像快照的 DB 持久化（让画像跨设备/重装不丢）。
   POST：generating 生成后写入；GET：home/result 跨设备读取。按租户隔离。
   ================================================================ */

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const snapshot = await getLatestBuiltProfileSnapshot(tenant).catch(() => null)
  return NextResponse.json({ ok: true, data: { snapshot } })
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const body = await request.json().catch(() => ({}))
    const s = body?.snapshot
    if (!s || typeof s.coreJudgment !== 'string' || !s.coreJudgment.trim()) {
      return NextResponse.json({ ok: false, error: { code: 'BAD_SNAPSHOT', message: '快照内容缺失' } }, { status: 400 })
    }
    const tenant = await resolveTenant()
    const snapshot: BuiltProfileSnapshot = {
      completeness: typeof s.completeness === 'number' ? s.completeness : 0,
      coreJudgment: String(s.coreJudgment),
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
    return NextResponse.json({ ok: true, data: { saved: true } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: 'PROFILE_BUILT_ERROR', message: String(error) } }, { status: 500 })
  }
}
