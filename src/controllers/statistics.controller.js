const { PrismaClient } = require('@prisma/client');
const { buildUserAdvice } = require('../services/advice.service');

const prisma = new PrismaClient();

async function getMyAdvice(req, res) {
  try {
    const userId = req.user.id;

    const items = await buildUserAdvice(prisma, userId);

    return res.json({ items });
  } catch (error) {
    console.error('Error cargando consejos:', error);

    return res.status(500).json({
      message: 'No se pudieron cargar los consejos',
    });
  }
}

module.exports = {
  getMyAdvice,
};