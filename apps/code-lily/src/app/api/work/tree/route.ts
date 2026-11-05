import { services } from '@/composition';
import { api } from '@/presentation/http';
export function GET(request: Request) {
  return api(request, async (actor) => (await services()).work.tree(actor));
}
