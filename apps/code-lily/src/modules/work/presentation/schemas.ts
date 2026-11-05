import { z } from 'zod';

export const workId = z.uuid();
const treeVersion = z.number().int().positive().max(2147483646);
const name = z
  .string()
  .trim()
  .normalize()
  .min(1)
  .max(200)
  .refine(
    (value) => !/[\u0000-\u001f\u007f/\\:*?"<>|]/.test(value),
    '이름에 사용할 수 없는 문자가 있습니다.',
  );
export const workContent = z.string().max(100000, '문서는 최대 100,000자입니다.');
export const workCreate = z
  .object({
    parentId: workId.nullable(),
    name,
    nodeType: z.enum(['FOLDER', 'DOCUMENT']),
    treeVersion,
  })
  .strict();
export const workChange = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rename'), name, treeVersion }).strict(),
  z.object({ action: z.literal('visibility'), isPublic: z.boolean(), treeVersion }).strict(),
  z
    .object({
      action: z.literal('move'),
      parentId: workId.nullable(),
      sortOrder: z.number().int().min(0).max(2000),
      treeVersion,
    })
    .strict(),
  z.object({ action: z.literal('delete'), treeVersion }).strict(),
  z.object({ action: z.literal('restore'), treeVersion }).strict(),
]);
export const workSave = z.object({ content: workContent, version: treeVersion }).strict();
