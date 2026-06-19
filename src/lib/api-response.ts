import type { ApiResult } from '@/types/childos';
import { classifyError, defaultsForStatus, type ErrorType } from '@/lib/server/error-codes';

export function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ok<T>(data: T, id = requestId()): Response {
  const body: ApiResult<T> = { ok: true, data, requestId: id };
  return Response.json(body);
}

// 统一失败响应。errorType/retriable 默认按 HTTP 状态码推（429/503→可重试，4xx→校验不重试），可用 opts 覆盖。
export function fail(
  code: string,
  message: string,
  detail?: unknown,
  status = 400,
  opts?: { errorType?: ErrorType; retriable?: boolean }
): Response {
  const d = defaultsForStatus(status);
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        detail,
        errorType: opts?.errorType ?? d.errorType,
        retriable: opts?.retriable ?? d.retriable
      },
      requestId: requestId()
    },
    { status }
  );
}

// catch 块一行收口：把 thrown error 分类成标准响应（LLM 限流/超时、DB 故障 → 临时可重试；其余 → 永久）。
export function failFromError(error: unknown): Response {
  const c = classifyError(error);
  return Response.json(
    {
      ok: false,
      error: {
        code: c.code,
        message: c.message,
        detail: error instanceof Error ? error.message : String(error),
        errorType: c.errorType,
        retriable: c.retriable
      },
      requestId: requestId()
    },
    { status: c.status }
  );
}

export async function waitMock(ms = 650) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
