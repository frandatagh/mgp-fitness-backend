import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prismaClient.js";

describe("Routines CRUD", () => {
  let token;
  let routineId;

  beforeAll(async () => {
    const email = `rut+${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ email, password: "123456" });
    const log = await request(app).post("/api/auth/login").send({ email, password: "123456" });
    token = log.body.token;
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany();
    await prisma.routine.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  test("create/list/get/update/delete routine", async () => {
    const created = await request(app)
      .post("/api/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Fuerza 3x", notes: "Full body" })
      .expect(201);

    routineId = created.body.id;

    await request(app)
      .get("/api/routines")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get(`/api/routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .put(`/api/routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Fuerza 4x" })
      .expect(200);

    await request(app)
      .delete(`/api/routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });
});
