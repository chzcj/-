import { fail, ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'

/** 音频文件转写：当前依赖客户端按住录音实时 ASR；上传文件暂提示改用录音或粘贴文字。 */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError()
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof Blob)) {
    return fail('BAD_REQUEST', '请选择音频文件。', undefined, 400)
  }
  if (file.size > 15 * 1024 * 1024) {
    return fail('BAD_REQUEST', '音频文件过大，请剪短到 15MB 以内。', undefined, 400)
  }
  return fail(
    'ASR_FILE_PENDING',
    '文件转写正在接入，请先使用「按住录音」或把对话文字粘贴到输入框。',
    { size: file.size },
    501
  )
}
