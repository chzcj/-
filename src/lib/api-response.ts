import type { ApiResult } from '@/types/childos';

export function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ok<T>(data: T, id = requestId()): Response {
  const body: ApiResult<T> = { ok: true, data, requestId: id };
  return Response.json(body);
}

export function fail(code: string, message: string, detail?: unknown, status = 400, id = requestId()): Response {
  return Response.json({ ok: false, error: { code, message, detail }, requestId: id }, { status });
}

export async function waitMock(ms = 650) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
