'use client';

import type { ApiResult, AuthUser, ProfileSnapshotData } from '@/types/childos';

function fallbackError(detail?: unknown): ApiResult<never> {
  return {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '今天有点忙，我们稍后再试。', detail, errorType: 'temporary', retriable: true },
    requestId: 'client_error'
  };
}

function normalizeResult<T>(json: unknown): ApiResult<T> {
  if (!json || typeof json !== 'object') return fallbackError('empty_response');
  const maybe = json as Partial<ApiResult<T>>;
  if (maybe.ok === true && 'data' in maybe && typeof maybe.requestId === 'string') {
    return maybe as ApiResult<T>;
  }
  if (maybe.ok === false && maybe.error && typeof maybe.error === 'object' && typeof maybe.requestId === 'string') {
    return maybe as ApiResult<T>;
  }
  return fallbackError(json);
}

const AUTH_POST_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/demo']);

function isAuthPost(path: string, method: string) {
  return method === 'POST' && AUTH_POST_PATHS.has(path);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  // GET 幂等：对临时可重试错误(retriable)与网络异常自动重试一次。
  // 认证 POST：网络异常可重试一次（登录/注册本身幂等安全：重复注册返回 PHONE_EXISTS）。
  const method = (init?.method || 'GET').toUpperCase();
  const canRetryGet = method === 'GET';
  const canRetryAuthPost = isAuthPost(path, method);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(path, {
        credentials: 'include',
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {})
        }
      });
      const json = await response.json().catch(() => undefined);
      const result = normalizeResult<T>(json);
      if (!response.ok && result.ok) return fallbackError({ status: response.status, path });
      if (!result.ok && result.error.retriable && canRetryGet && attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return result;
    } catch (error) {
      const retriable = canRetryGet || canRetryAuthPost;
      if (retriable && attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      return fallbackError(String(error));
    }
  }
}

/** 仅保留活跃页面在用的方法（auth + 画像读取）。
 *  旧问题流/理解卡/归档/管理后台等方法已随对应死页面与死 API 一并移除。 */
export const apiClient = {
  getMe(init?: RequestInit) {
    return requestJson<{ user: AuthUser | null }>('/api/auth/me', init);
  },
  login(input: { phone: string; password: string }, init?: RequestInit) {
    return requestJson<{ user: AuthUser }>('/api/auth/login', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  demoLogin(init?: RequestInit) {
    return requestJson<{ user: AuthUser }>('/api/auth/demo', {
      ...init,
      method: 'POST',
      body: JSON.stringify({})
    });
  },
  register(input: { phone: string; password: string }, init?: RequestInit) {
    return requestJson<{ user: AuthUser }>('/api/auth/register', {
      ...init,
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  logout(init?: RequestInit) {
    return requestJson<{ loggedOut: true }>('/api/auth/logout', {
      ...init,
      method: 'POST',
      body: JSON.stringify({})
    });
  },
  getProfileSnapshot(input: { familyId?: string; childId?: string } = {}, init?: RequestInit) {
    const params = new URLSearchParams({
      familyId: input.familyId || 'f_demo',
      childId: input.childId || 'c_demo'
    });
    return requestJson<ProfileSnapshotData>(`/api/profile/snapshot?${params.toString()}`, init);
  },
  getWeeklyReview(input: { familyId?: string; childId?: string } = {}, init?: RequestInit) {
    const params = new URLSearchParams({
      familyId: input.familyId || 'f_demo',
      childId: input.childId || 'c_demo'
    });
    return requestJson<{
      sessionCount: number;
      recentClues: Array<{ type: string; title: string; content: string; createdAt?: string }>;
      childEvents: Array<{ title: string; eventText: string; createdAt?: string }>;
      weeklySummary: string;
    }>(`/api/profile/weekly-review?${params.toString()}`, init);
  }
};
