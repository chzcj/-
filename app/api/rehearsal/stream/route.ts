import { fail } from '@/lib/api-response';
import { z } from 'zod';
import { submitRehearsalStreaming } from '@/lib/server/store';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { resolveTenant } from '@/lib/server/memory/tenant';

const rehearsalStreamSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().trim().min(1).max(3000)
});

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError();

  const body = await request.json().catch(() => ({}));
  const parsed = rehearsalStreamSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  const tenant = await resolveTenant();
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          send({ type: 'start' });
          const reply = await submitRehearsalStreaming(
            parsed.data.conversationId,
            parsed.data.text,
            (delta) => {
              send({ type: 'delta', delta });
            },
            tenant
          );
          if (!reply) {
            send({ type: 'error', message: '我暂时没有整理出回应，你可以再说一次。' });
            controller.close();
            return;
          }
          send({ type: 'final', text: reply });
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
