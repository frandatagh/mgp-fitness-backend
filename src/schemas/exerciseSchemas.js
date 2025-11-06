import { z } from "zod";

export const exerciseCreateSchema = z.object({
  name: z.string().min(1),
  sets: z.string().optional(),
  reps: z.string().optional(),
  notes: z.string().optional(),
  order: z.number().int().optional()
});

export const exerciseUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  sets: z.string().optional(),
  reps: z.string().optional(),
  notes: z.string().optional(),
  order: z.number().int().optional()
});

export const exerciseParamsSchema = z.object({
  routineId: z.string().min(1),
  exerciseId: z.string().min(1).optional()
});
