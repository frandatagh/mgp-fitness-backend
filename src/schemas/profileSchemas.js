import { z } from 'zod';

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),

  goal: z.string().trim().max(500).nullable().optional(),

  heightCm: z
    .union([z.number(), z.null()])
    .optional(),

  weightKg: z
    .union([z.number(), z.null()])
    .optional(),

  birthDate: z
    .union([z.string().datetime(), z.null()])
    .optional(),

 profileImageUrl: z
  .union([z.string().trim().url(), z.string().trim().length(0), z.null()])
  .optional(),

  planType: z
    .enum(['standard', 'pro', 'professional'])
    .optional(),

  weeklyKmGoal: z
    .union([z.number(), z.null()])
    .optional(),
});