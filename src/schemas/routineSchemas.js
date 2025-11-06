import { z } from "zod";

export const routineCreateSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional()
});

export const routineUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional()
});

export const routineIdParamsSchema = z.object({
  id: z.string().min(1)
});
