const { prisma } = require('../prismaClient'); // o como lo tengas

exports.markDone = async ({ id, userId }) => {
  // opcional: validar que la rutina pertenece al usuario
  const routine = await prisma.routine.update({
    where: { id },
    data: {
      lastDoneAt: new Date(),
    },
    include: {
      exercises: true, // si ya lo usás en otras consultas
    },
  });

  return routine;
};
