import { uploadsService } from '@/composition';
import { api } from '@/presentation/http';
import { writer } from '@/modules/identity/domain/policy';
import { z } from 'zod';
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(
    request,
    async (actor) => {
      writer(actor);
      return (await uploadsService()).complete(z.uuid().parse((await context.params).id), actor);
    },
    { mutation: true },
  );
}
