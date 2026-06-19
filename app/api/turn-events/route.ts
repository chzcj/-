import { ok } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { getTurnEventByTraceId, listTurnEvents } from '@/lib/server/memory/database-manager';

// TurnEvent 审计接口（交付文档 13.1 可复现）：按 traceId 取回某轮的输入+输出快照，或列最近若干轮。
// 本租户限定（resolveTenant + 层读取按 family/child 隔离），杜绝跨租户。
export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError();
  const tenant = await resolveTenant();
  const traceId = new URL(request.url).searchParams.get('traceId')?.trim();

  if (traceId) {
    const turnEvent = await getTurnEventByTraceId(tenant, traceId);
    return ok({ turnEvent });
  }

  const turnEvents = await listTurnEvents(tenant, 50);
  return ok({ turnEvents });
}
