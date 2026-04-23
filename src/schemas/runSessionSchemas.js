import { z } from 'zod';

export const createRunSessionSchema = z.object({
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationSeconds: z.number().int().min(0),
  distanceMeters: z.number().min(0),
  avgPaceSecPerKm: z.number().min(0).nullable().optional(),
  maxSpeedMps: z.number().min(0).nullable().optional(),
  pathGeoJson: z.any().optional().nullable(),
});