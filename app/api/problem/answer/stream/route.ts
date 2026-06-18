import { fail } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { problemAnswerSchema } from '@/lib/schemas';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { submitAnswerStreaming } from '@/lib/server/store';

export async function POST(request: Request) {
  // 鉴权须在创建流式 Response 之前返回。
  if (!(await verifyAppApi(request))) return authError();
  const body = await request.json().catch(() => ({}));
  const parsed = problemAnswerSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  // 租户在 POST 同步上下文解析（cookies() 合法），供流内会话归属校验。
  const tenant = await resolveTenant();
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          send({ type: 'start', round: parsed.data.round + 1 });
          const a1 = await submitAnswerStreaming(parsed.data.conversationId, tenant, parsed.data.round, parsed.data.inputMode, parsed.data.text, (delta) => {
            send({ type: 'delta', delta });
          });
          if (!a1) {
            send({ type: 'error', message: '我找不到刚刚那次整理了。' });
            controller.close();
            return;
          }
          send({
            type: 'final',
            data: {
              nextAction: a1.clientActions.nextAction,
              a1
            }
          });
          controller.close();
        } catch (error) {
          send({ type: 'error', message: '这次输入没有整理成功，可以再试一次。', detail: String(error) });
          controller.close();
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    }
  );
}
