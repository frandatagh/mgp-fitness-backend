import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { profileUpdateSchema } from '../schemas/profileSchemas.js';

const router = express.Router();

function getAuthUserId(req) {
  return req.user?.id ?? req.user?.userId ?? req.user?.sub ?? null;
}

// GET /api/profile/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const authUserId = getAuthUserId(req);

    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let user = await prisma.user.findUnique({
      where: { id: authUserId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Si todavía no existe perfil, lo creamos automáticamente
    if (!user.profile) {
      const profile = await prisma.userProfile.create({
        data: {
          userId: user.id,
        },
      });

      user = {
        ...user,
        profile,
      };
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile: user.profile,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/profile/me
router.patch('/me', verifyToken, validate(profileUpdateSchema), async (req, res, next) => {
  try {
    const authUserId = getAuthUserId(req);

    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      name,
      goal,
      heightCm,
      weightKg,
      birthDate,
      profileImageUrl,
      planType,
      weeklyKmGoal,
    } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: authUserId },
      include: { profile: true },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Actualizar nombre en User si vino
    let updatedUser = existingUser;
    if (typeof name !== 'undefined') {
      updatedUser = await prisma.user.update({
        where: { id: authUserId },
        data: {
          name: name === '' ? null : name,
        },
        include: { profile: true },
      });
    }

    // Crear o actualizar perfil
    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: authUserId },
      create: {
        userId: authUserId,
        goal: typeof goal !== 'undefined' ? goal : null,
        heightCm: typeof heightCm !== 'undefined' ? heightCm : null,
        weightKg: typeof weightKg !== 'undefined' ? weightKg : null,
        birthDate: typeof birthDate !== 'undefined' && birthDate ? new Date(birthDate) : null,
        profileImageUrl:
          typeof profileImageUrl !== 'undefined'
            ? profileImageUrl || null
            : null,
        planType: planType ?? 'standard',
        weeklyKmGoal: typeof weeklyKmGoal !== 'undefined' ? weeklyKmGoal : null,
      },
      update: {
        ...(typeof goal !== 'undefined' ? { goal } : {}),
        ...(typeof heightCm !== 'undefined' ? { heightCm } : {}),
        ...(typeof weightKg !== 'undefined' ? { weightKg } : {}),
        ...(typeof birthDate !== 'undefined'
          ? { birthDate: birthDate ? new Date(birthDate) : null }
          : {}),
        ...(typeof profileImageUrl !== 'undefined'
          ? { profileImageUrl: profileImageUrl || null }
          : {}),
        ...(typeof planType !== 'undefined' ? { planType } : {}),
        ...(typeof weeklyKmGoal !== 'undefined' ? { weeklyKmGoal } : {}),
      },
    });

    return res.json({
      message: 'Perfil actualizado correctamente',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
      profile: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
});

export default router;