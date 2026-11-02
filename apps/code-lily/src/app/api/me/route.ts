import { api } from '@/presentation/http';
import { googleConfigured } from '@/modules/identity/infrastructure/auth';
export function GET(request: Request) {
  return api(request, async (actor) => ({ actor, googleConfigured: googleConfigured() }));
}
