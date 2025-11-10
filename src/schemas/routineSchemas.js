// src/schemas/routineSchemas.js
import { z } from "zod";

export const routineCreateSchema = z.object({
  title: z.string().trim().min(1),
  notes: z.string().optional(),
  exercises: z.array(
    z.object({
      name: z.string().trim().min(1),
      sets: z.string().optional(),
      reps: z.string().optional(),
      notes: z.string().optional(),
      order: z.number().int().optional()
    })
  ).optional()
});

export const routineUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  notes: z.string().optional()
});

export const routineIdParamsSchema = z.object({
  id: z.string().min(1)
});

// Para importación explícita (igual que create, pero separado por claridad)
export const routineImportJsonSchema = routineCreateSchema;

// Límite razonable para import
export const routineImportLimitSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.string().max(1000).optional(),
  exercises: z.array(
    z.object({
      name: z.string().trim().min(1).max(120),
      sets: z.string().max(50).optional(),
      reps: z.string().max(50).optional(),
      notes: z.string().max(300).optional(),
      order: z.number().int().min(0).max(1000).optional()
    })
  ).max(200).optional() // evita imports gigantes
});
