import { ok } from '@/lib/api-response';
import { loginAsDemoUser } from '@/lib/server/auth';

export async function POST() {
  const user = await loginAsDemoUser();
  return ok({ user });
}
