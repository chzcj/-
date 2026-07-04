import { ZodError } from 'zod'
import { fail, ok } from '@/lib/api-response';
import { authCredentialsSchema } from '@/lib/schemas';
import { parseAccountBackupBody } from '@/lib/server/account-backup-schema';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import {
  getAccountClientBackup,
  saveAccountClientBackup,
  type AccountClientBackup,
} from '@/lib/server/memory/database-manager';
import { resolveTenant } from '@/lib/server/memory/tenant';

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const tenant = await resolveTenant()
  const backup = await getAccountClientBackup(tenant).catch(() => null)
  return ok({ backup })
}

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = parseAccountBackupBody(raw)
    const tenant = await resolveTenant()

    const backup: AccountClientBackup = {
      version: 'account.client.v1',
      dailyThread: parsed.dailyThread,
      storage: parsed.storage ?? null,
      updatedAt: new Date().toISOString(),
    }
    await saveAccountClientBackup(backup, tenant)
    return ok({ saved: true, backup })
  } catch (error) {
    if (error instanceof Error && error.message === 'BACKUP_TOO_LARGE') {
      return fail('BACKUP_TOO_LARGE', '备份数据过大，请减少本地缓存后重试。', undefined, 413)
    }
    if (error instanceof ZodError) {
      return fail('BAD_REQUEST', '备份数据格式不正确。', error.flatten(), 400)
    }
    return fail('SAVE_FAILED', '备份保存失败，请稍后再试。', undefined, 500)
  }
}
