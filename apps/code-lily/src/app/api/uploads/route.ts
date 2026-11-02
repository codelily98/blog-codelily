import { uploadsService } from '@/composition';
import { api, jsonBody } from '@/presentation/http';
import { AppError, writer } from '@/modules/identity/domain/policy';
import { allowedContentTypes, storageConfigured } from '@codelily/storage';
import { z } from 'zod';
export function POST(request: Request) {
  return api(
    request,
    async (actor) => {
      writer(actor);
      if (!storageConfigured())
        throw new AppError(503, 'Cloudflare R2 설정 후 파일을 업로드할 수 있습니다.');
      const input = z
        .object({
          contentType: z.enum(allowedContentTypes),
          size: z.number().int().min(1).max(10485760),
          public: z.boolean(),
        })
        .parse(await jsonBody(request));
      return (await uploadsService()).reserve(input, actor);
    },
    { mutation: true },
  );
}
