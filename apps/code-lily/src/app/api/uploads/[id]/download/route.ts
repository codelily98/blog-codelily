import { uploadsService } from '@/composition';
import { api } from '@/presentation/http';
import { authenticated } from '@/modules/identity/domain/policy';
import { z } from 'zod';
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(request, async (actor) => {
    authenticated(actor);
    return (await uploadsService()).download(z.uuid().parse((await context.params).id), actor);
  });
}
