export interface ApiErrorBody {
  code: string
  message: string
  detail?: unknown
  errorType?: 'validation' | 'temporary' | 'permanent'
  retriable?: boolean
}

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: ApiErrorBody; requestId: string }

export interface AuthUser {
  userId: string
  phone: string
  familyId: string
  childId: string
  isAdmin: boolean
  onboardingComplete: boolean
}

export interface WechatLoginResponse {
  user: AuthUser
  sessionToken: string
  isNewUser: boolean
}
