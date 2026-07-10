import Taro from '@tarojs/taro'
import { API_BASE_URL, STORAGE_KEYS } from '@/config/env'
import type { ApiResult } from '@yujian/contracts'

export function getSessionToken(): string | null {
  try {
    return Taro.getStorageSync(STORAGE_KEYS.sessionToken) || null
  } catch {
    return null
  }
}

export function setSessionToken(token: string) {
  Taro.setStorageSync(STORAGE_KEYS.sessionToken, token)
}

export function clearSessionToken() {
  Taro.removeStorageSync(STORAGE_KEYS.sessionToken)
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  auth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', data, auth = true } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (auth) {
    const token = getSessionToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  try {
    const res = await Taro.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data: data as Record<string, unknown> | undefined,
      header: headers,
      timeout: 120000,
    })
    const json = res.data as ApiResult<T>
    if (json && typeof json === 'object' && 'ok' in json) return json
    return {
      ok: false,
      error: { code: 'BAD_RESPONSE', message: '服务返回格式异常' },
      requestId: '',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络请求失败'
    return {
      ok: false,
      error: { code: 'NETWORK_ERROR', message, errorType: 'temporary', retriable: true },
      requestId: '',
    }
  }
}
