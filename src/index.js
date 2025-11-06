
import "dotenv/config";
import app from "./app.js";
import prisma from "./config/prismaClient.js";

const PORT = process.env.PORT || 3000;

// Conectamos a la DB al arrancar (si falla, salimos con error claro)
prisma.$connect()
  .then(() => {
    console.log("✅ DB connected");
    app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  });

// Cierre limpio (opcional)
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
