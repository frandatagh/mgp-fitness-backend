import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Correo inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Token inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});