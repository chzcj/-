import 'server-only'

import { loadMemoryLayerItemById, upsertMemoryLayerItems } from '@/lib/server/db'
import type { DeepModelDigest } from '@/types/deep-model-digest'
import type { TenantId } from '@/lib/server/memory/tenant'

const LAYER = 'deep_model_digest'
const ITEM_ID = 'latest'

export async function loadDeepModelDigest(tenant: TenantId): Promise<DeepModelDigest | null> {
  const item = await loadMemoryLayerItemById<DeepModelDigest>(
    LAYER,
    ITEM_ID,
    tenant.familyId,
    tenant.childId
  ).catch(() => undefined)
  return item ?? null
}

export async function saveDeepModelDigest(digest: DeepModelDigest, tenant: TenantId): Promise<void> {
  await upsertMemoryLayerItems(
    LAYER,
    [
      {
        itemId: ITEM_ID,
        familyId: tenant.familyId,
        childId: tenant.childId,
        data: digest,
      },
    ],
    tenant.familyId,
    tenant.childId
  )
}
