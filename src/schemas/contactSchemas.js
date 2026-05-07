import { z } from 'zod';

export const contactCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nombre inválido'),
  email: z.string().trim().email('Correo inválido'),
  inquiryType: z.enum(['technical', 'general', 'suggestion', 'bug', 'other']),
  subject: z.string().trim().min(4).max(80),
  message: z.string().trim().min(15).max(1000),

  sentFrom: z.enum(['authenticated', 'guest']),
  platform: z.string().trim().min(1),
  accountName: z.string().trim().nullable().optional(),
  accountEmail: z.string().trim().nullable().optional(),
});