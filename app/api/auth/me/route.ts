import { ok } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/server/auth';

export async function GET() {
  const user = await getCurrentUser();
  return ok({ user: user || null });
}
