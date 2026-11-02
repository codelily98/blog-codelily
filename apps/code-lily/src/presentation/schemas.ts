import { z } from 'zod';
const slug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '주소에는 영문 소문자·숫자·하이픈만 사용할 수 있습니다.');
const text = (max: number) => z.string().trim().max(max);
export const postSchema = z.object({
  id: z.uuid().optional(),
  title: text(160).min(1, '제목을 입력해주세요.'),
  slug,
  excerpt: text(300).default(''),
  source: z.string().min(1, '본문을 입력해주세요.').max(500000),
  format: z.enum(['HTML', 'MARKDOWN']),
  tags: z.array(text(30).min(1)).max(10).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  categoryId: z.uuid().nullable(),
});
export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: text(60).min(1, '카테고리 이름을 입력해주세요.'),
  slug,
});
const safeUrl = z
  .string()
  .max(2000)
  .refine(
    (value) => !value || /^(https?:\/\/|mailto:)/i.test(value),
    'https 또는 mailto 주소를 입력해주세요.',
  );
export const aboutSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(['INTRO', 'EXPERIENCE', 'INTERESTS', 'CONTACT', 'CUSTOM']),
  title: text(160).min(1),
  subtitle: text(300).default(''),
  source: z.string().max(500000),
  format: z.enum(['HTML', 'MARKDOWN']),
  sortOrder: z.number().int().min(0).max(999),
  published: z.boolean(),
  items: z
    .array(z.object({ label: text(160), detail: text(500), period: text(100), url: safeUrl }))
    .max(40),
});
