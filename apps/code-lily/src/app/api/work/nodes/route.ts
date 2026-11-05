import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { workCreate } from '@/modules/work/presentation/schemas';
export function POST(request: Request) {
  return api(
    request,
    async (actor) =>
      (await services()).work.create(workCreate.parse(await jsonBody(request)), actor),
    { mutation: true },
  );
}
