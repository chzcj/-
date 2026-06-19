import { ok } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { getLatestChildStructureModel } from '@/lib/server/memory/database-manager';
import { getCurrentVersions } from '@/lib/server/db';

// 首次建模三件套 v1 就绪检查（交付文档 3.4 / 13.4）：
// FamilyModel v1(ChildStructureModel) + Family Brief v1 + BoardSnapshot v1 是否都已产出。
// generating 页据此在跳 result 前等待 v1 链路跑通（带超时兜底）。本租户限定。
// 注意：区别于基础设施探针 /api/readiness（那个查 DB/FastAI 连通）。
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError();
  const tenant = await resolveTenant();

  const [model, versions] = await Promise.all([
    getLatestChildStructureModel(tenant).catch(() => null),
    getCurrentVersions(tenant.familyId, tenant.childId).catch(() => ({ briefVersion: 0, boardVersion: 0 }))
  ]);

  const familyModel = Boolean(model);
  const brief = versions.briefVersion > 0;
  const board = versions.boardVersion > 0;

  return ok({ familyModel, brief, board, ready: familyModel && brief && board });
}
