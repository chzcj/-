import { ok } from '@/lib/api-response';
import { logoutCurrentUser } from '@/lib/server/auth';

export async function POST() {
  await logoutCurrentUser();
  return ok({ loggedOut: true });
}
