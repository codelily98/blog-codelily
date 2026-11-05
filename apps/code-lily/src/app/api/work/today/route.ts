import { services } from '@/composition';
import { api } from '@/presentation/http';
export function POST(request: Request) {
  return api(request, async (actor) => (await services()).work.today(actor), { mutation: true });
}
