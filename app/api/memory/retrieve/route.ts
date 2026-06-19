import { ok, failFromError } from '@/lib/api-response'
import { runMemoryRetrievePipeline } from '@/lib/server/memory/pipeline'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import type { EntryName } from '@/types/database'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  try {
    const url = new URL(request.url)
    const purpose = url.searchParams.get('purpose') || 'daily_dialogue'
    const targetEntry = url.searchParams.get('targetEntry') as EntryName | null

    const validPurposes = ['daily_dialogue', 'deep_diagnosis', 'entry_collection', 'multi_entry_synthesis'] as const
    const safePurpose = validPurposes.includes(purpose as typeof validPurposes[number])
      ? purpose as typeof validPurposes[number]
      : 'daily_dialogue'

    // 会话身份为准（无会话回落 f_demo），忽略 query 的 familyId/childId——杜绝借 query 越权检索他人租户记忆。
    const tenant = await resolveTenant()

    const result = await runMemoryRetrievePipeline(safePurpose as 'daily_dialogue' | 'deep_diagnosis' | 'entry_collection' | 'multi_entry_synthesis', tenant, targetEntry || undefined)

    return ok(result)
  } catch (error) {
    return failFromError(error)
  }
}
