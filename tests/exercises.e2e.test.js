// tests/exercises.e2e.test.js
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prismaClient.js";
import { execSync } from "node:child_process";

describe("Exercises nested CRUD", () => {
  let token;
  let routineId;
  let exerciseId;

  beforeAll(() => {
    // Aplica migraciones en la DB de test (usa DATABASE_URL de package.json script)
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  });

  beforeAll(async () => {
    // crear usuario y loguear
    const email = `ex+${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ email, password: "123456" }).expect(201);
    const log = await request(app).post("/api/auth/login").send({ email, password: "123456" }).expect(200);
    token = log.body.token;

    // crear rutina para colgar ejercicios
    const rut = await request(app)
      .post("/api/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Rutina para tests", notes: "tmp" })
      .expect(201);

    routineId = rut.body.id;
  });

  afterAll(async () => {
    // limpieza básica
    await prisma.exercise.deleteMany({ where: { routineId } });
    await prisma.routine.deleteMany({ where: { id: routineId } });
    await prisma.user.deleteMany(); // test DB, se limpia todo
    await prisma.$disconnect();
  });

  test("create exercise -> 201", async () => {
    const res = await request(app)
      .post(`/api/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Press banca", sets: "3x10", reps: "10-12", notes: "calent", order: 1 })
      .expect(201);

    exerciseId = res.body.id;
    expect(res.body.name).toBe("Press banca");
  });

  test("list exercises -> 200", async () => {
    const res = await request(app)
      .get(`/api/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("update exercise (invalid order) -> 400", async () => {
    await request(app)
      .put(`/api/routines/${routineId}/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ order: "dos" }) // debería fallar por Zod
      .expect(400);
  });

  test("update exercise (valid) -> 200", async () => {
    const res = await request(app)
      .put(`/api/routines/${routineId}/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ order: 2, notes: "ok" })
      .expect(200);

    expect(res.body.order).toBe(2);
    expect(res.body.notes).toBe("ok");
  });

  test("delete exercise -> 204", async () => {
    await request(app)
      .delete(`/api/routines/${routineId}/exercises/${exerciseId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });
});
