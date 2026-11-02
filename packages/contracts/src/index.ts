import { z } from 'zod';

export const roleSchema = z.enum(['MEMBER', 'EDITOR', 'OWNER']);
export type Role = z.infer<typeof roleSchema>;
export const summarySchema = z.object({
  version: z.literal(1),
  service: z.string(),
  asOf: z.string(),
  status: z.enum(['ok', 'unavailable']),
  metrics: z.object({
    publishedPosts: z.number().int().nonnegative(),
    pageViews: z.number().int().nonnegative(),
    uniqueBrowsers: z.number().int().nonnegative(),
  }),
});
export type ServiceSummary = z.infer<typeof summarySchema>;
