const express = require('express');
const prisma = require('../prisma');
const router = express.Router();

// TODO: agregar middleware auth
router.get('/', async (req, res, next) => {
  try {
    // temporal: lista todas (en prod filtrar por user)
    const routines = await prisma.routine.findMany({ include: { exercises: true }});
    res.json(routines);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, exercises, ownerId } = req.body;
    // validaciones básicas
    if (!title || !ownerId) return res.status(400).json({ message: 'title and ownerId required' });

    const created = await prisma.routine.create({
      data: {
        title,
        description,
        owner: { connect: { id: ownerId } },
        exercises: { create: exercises?.map((ex, idx) => ({ name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight, note: ex.note, order: idx })) }
      },
      include: { exercises: true }
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

module.exports = router;
