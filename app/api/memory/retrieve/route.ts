import { NextResponse } from 'next/server'
import { runMemoryRetrievePipeline } from '@/lib/server/memory/pipeline'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import type { EntryName } from '@/types/database'

export async function GET(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const url = new URL(request.url)
    const purpose = url.searchParams.get('purpose') || 'daily_dialogue'
    const targetEntry = url.searchParams.get('targetEntry') as EntryName | null

    const validPurposes = ['daily_dialogue', 'deep_diagnosis', 'entry_collection', 'multi_entry_synthesis'] as const
    const safePurpose = validPurposes.includes(purpose as typeof validPurposes[number])
      ? purpose as typeof validPurposes[number]
      : 'daily_dialogue'

    const result = await runMemoryRetrievePipeline(safePurpose as 'daily_dialogue' | 'deep_diagnosis' | 'entry_collection' | 'multi_entry_synthesis', targetEntry || undefined)

    return NextResponse.json({
      ok: true,
      data: result
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: { code: 'RETRIEVE_ERROR', message: String(error) }
    }, { status: 500 })
  }
}
