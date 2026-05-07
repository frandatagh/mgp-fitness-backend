// src/routes/contact.js
import express from 'express';
import prisma from '../config/prismaClient.js';
import { validate } from '../middlewares/validate.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';
import { contactCreateSchema } from '../schemas/contactSchemas.js';
import { sendContactNotificationEmail } from '../services/emailService.js';

const router = express.Router();

router.post(
  '/',
  optionalAuth,
  validate(contactCreateSchema),
  async (req, res, next) => {
    try {
      const {
        name,
        email,
        inquiryType,
        subject,
        message,
        sentFrom,
        platform,
        accountName,
        accountEmail,
      } = req.body;

      const created = await prisma.contactMessage.create({
        data: {
          name,
          email,
          inquiryType,
          subject,
          message,
          sentFrom,
          platform,
          accountName: accountName ?? null,
          accountEmail: accountEmail ?? null,
          userId: req.user?.id ?? req.user?.userId ?? req.user?.sub ?? null,
        },
      });

      // Intento de envío por email SIN romper el guardado si falla
      try {
        await sendContactNotificationEmail({
          name: created.name,
          email: created.email,
          inquiryType: created.inquiryType,
          subject: created.subject,
          message: created.message,
          sentFrom: created.sentFrom,
          platform: created.platform,
          accountName: created.accountName,
          accountEmail: created.accountEmail,
          userId: created.userId,
          createdAt: created.createdAt.toISOString(),
        });
      } catch (mailError) {
        console.error('Error reenviando email con Resend:', mailError);
      }

      return res.status(201).json({
        message: 'Mensaje guardado correctamente',
        id: created.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;