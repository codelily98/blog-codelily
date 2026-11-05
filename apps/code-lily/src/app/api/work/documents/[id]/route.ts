import { services } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { workId, workSave } from '@/modules/work/presentation/schemas';
type Context = { params: Promise<{ id: string }> };
export function GET(request: Request, context: Context) {
  return api(request, async (actor) =>
    (await services()).work.read(workId.parse((await context.params).id), actor),
  );
}
export function PUT(request: Request, context: Context) {
  return api(
    request,
    async (actor) => {
      const input = workSave.parse(await jsonBody(request));
      return (await services()).work.save(
        workId.parse((await context.params).id),
        input.content,
        input.version,
        actor,
      );
    },
    { mutation: true },
  );
}
