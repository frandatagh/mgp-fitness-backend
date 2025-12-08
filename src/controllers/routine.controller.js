// src/controllers/routinesController.js (por ejemplo)
import prisma from '../config/prismaClient.js';

export async function updateRoutineHandler(req, res) {
  const userId = req.user.id;
  const routineId = req.params.id;
  const { title, notes, exercises } = req.body;

  try {
    // 1) Verificar que la rutina existe y es del usuario
    const existing = await prisma.routine.findFirst({
      where: { id: routineId, userId },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Rutina no encontrada' });
    }

    // 2) Usamos una transacción para actualizar rutina + ejercicios
    const updatedRoutine = await prisma.$transaction(async (tx) => {
      // 2.a) actualizar título / notas
      await tx.routine.update({
        where: { id: routineId },
        data: {
          title: title ?? existing.title,
          notes: notes ?? existing.notes,
        },
      });

      // 2.b) si nos mandaron ejercicios, reseteamos la lista
      if (Array.isArray(exercises)) {
        // borrar ejercicios anteriores
        await tx.exercise.deleteMany({
          where: { routineId },
        });

        if (exercises.length > 0) {
          await tx.exercise.createMany({
            data: exercises.map((ex, index) => ({
              name: ex.name,
              sets: ex.sets ?? null,
              reps: ex.reps ?? null,
              notes: ex.notes ?? null,
              day: ex.day ?? null,
              order:
                typeof ex.order === 'number'
                  ? ex.order
                  : index,
              routineId,
            })),
          });
        }
      }

      // 2.c) devolver la rutina con la lista nueva de ejercicios
      return tx.routine.findUnique({
        where: { id: routineId },
        include: {
          exercises: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    return res.json(updatedRoutine);
  } catch (err) {
    console.error('Error actualizando rutina:', err);
    return res
      .status(500)
      .json({ message: 'Error al actualizar la rutina' });
  }
}
