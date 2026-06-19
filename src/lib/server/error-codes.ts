/* ================================================================
   统一错误码与分类（前后端共用，无 server 依赖，可被前端 import 常量）。
   目标：让每个路由的错误响应有一致的 code / errorType / retriable，
   前端据 retriable 决定是否自动重试；catch 块用 classifyError 一行收口。
   ================================================================ */

export type ErrorType = 'validation' | 'temporary' | 'permanent';

export interface ClassifiedError {
  code: string;
  message: string;   // 家长可读
  status: number;
  errorType: ErrorType;
  retriable: boolean;
}

// 已知错误码常量（避免各路由各写一个字符串）。
export const ErrorCode = {
  EMPTY_INPUT: 'EMPTY_INPUT',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  LLM_API_ERROR: 'LLM_API_ERROR',
  EMBEDDING_API_ERROR: 'EMBEDDING_API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  DB_ERROR: 'DB_ERROR',
  TEMPORARY_UNAVAILABLE: 'TEMPORARY_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

// 按 HTTP 状态码推 errorType / retriable（fail() 默认值用）：
// 429/503 视为临时可重试，4xx 视为校验/客户端错误不重试，5xx 其它视为永久。
export function defaultsForStatus(status: number): { errorType: ErrorType; retriable: boolean } {
  if (status === 429 || status === 503) return { errorType: 'temporary', retriable: true };
  if (status >= 400 && status < 500) return { errorType: 'validation', retriable: false };
  return { errorType: 'permanent', retriable: false };
}

// 把任意 thrown error 分类成标准错误：LLM 限流/超时、DB 连接等 → 临时可重试；其余 → 永久。
export function classifyError(error: unknown): ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);
  // LLM 限流
  if (/\b429\b|rate.?limit|too many request|限流|requests per/i.test(msg)) {
    return { code: ErrorCode.RATE_LIMIT, message: '请求有点多，稍等一下再试。', status: 429, errorType: 'temporary', retriable: true };
  }
  // LLM 超时/中断/空输出/基础设施不可用 → 临时可重试
  if (/abort|timeout|ETIMEDOUT|FAST_AI_REQUEST_FAILED:5|FAST_AI_EMPTY_OUTPUT|EPISODE_VECTOR_UNAVAILABLE|FAST_AI_JSON_PARSE/i.test(msg)) {
    return { code: ErrorCode.LLM_API_ERROR, message: '这次没生成成功，稍后再试一次。', status: 503, errorType: 'temporary', retriable: true };
  }
  // LLM 其它请求失败
  if (/FAST_AI_/i.test(msg)) {
    return { code: ErrorCode.LLM_API_ERROR, message: 'AI 这次没整理成功，可以再试一次。', status: 503, errorType: 'temporary', retriable: true };
  }
  // DB 连接/查询失败 → 临时可重试
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|connection|connect|pool|relation|column|database|deadlock|EHOSTUNREACH/i.test(msg)) {
    return { code: ErrorCode.DB_ERROR, message: '数据这次没读写成功，稍后再试。', status: 503, errorType: 'temporary', retriable: true };
  }
  return { code: ErrorCode.INTERNAL_ERROR, message: '处理出错了，稍后再试。', status: 500, errorType: 'permanent', retriable: false };
}
