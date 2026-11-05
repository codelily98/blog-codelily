import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { workChange, workId } from '@/modules/work/presentation/schemas';
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(
    request,
    async (actor) =>
      (await services()).work.change(
        workId.parse((await context.params).id),
        workChange.parse(await jsonBody(request)),
        actor,
      ),
    { mutation: true },
  );
}
