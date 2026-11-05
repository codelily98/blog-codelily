import { services } from '@/composition';
import { api } from '@/presentation/http';
import { z } from 'zod';
export function GET(request: Request) {
  return api(request, async (actor) => {
    const query = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get('q'));
    return (await services()).work.search(query, actor);
  });
}
