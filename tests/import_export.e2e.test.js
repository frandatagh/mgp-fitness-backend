// tests/import_export.e2e.test.js
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prismaClient.js";

describe("Import/Export routines (JSON/CSV)", () => {
  let token;
  let routineId; // rutina base para exportar

  beforeAll(async () => {
    // Crea usuario único y loguea
    const email = `ie+${Date.now()}@example.com`;
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "123456", name: "Tester" })
      .expect(201);

    const log = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "123456" })
      .expect(200);

    token = log.body.token;

    // Crea una rutina base para pruebas de export
    const created = await request(app)
      .post("/api/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Rutina Export Base",
        notes: "para export test",
        exercises: [
          { name: "Press banca", sets: "3x10", reps: "10-12", notes: "calent", order: 1 },
          { name: "Sentadilla", sets: "3x8", reps: "8", order: 2 },
        ],
      })
      .expect(201);

    routineId = created.body.id;
  });

  afterAll(async () => {
    // Cierra conexiones Prisma al terminar la suite
    await prisma.$disconnect();
  });

  // ---------- EXPORT ----------
  it("export JSON → 200 + shape", async () => {
    const res = await request(app)
      .get(`/api/routines/${routineId}/export.json`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveProperty("title", "Rutina Export Base");
    expect(Array.isArray(res.body.exercises)).toBe(true);
    expect(res.body.exercises[0]).toHaveProperty("name");
  });

  it("export CSV → 200 + content-type + header", async () => {
    const res = await request(app)
      .get(`/api/routines/${routineId}/export.csv`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    const text = res.text;
    expect(text).toContain("title,notes,exercise_name,sets,reps,exercise_notes,order");
    expect(text).toContain("Rutina Export Base");
  });

  // ---------- IMPORT (happy paths) ----------
  it("import JSON válido → 201", async () => {
    const res = await request(app)
      .post(`/api/routines/import/json`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Import JSON Demo",
        notes: "desde JSON",
        exercises: [
          { name: "Remo con barra", sets: "3x10", reps: "10-12" },
          { name: "Peso muerto", sets: "3x5", reps: "5" },
        ],
      })
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "Import JSON Demo");
    expect(Array.isArray(res.body.exercises)).toBe(true);
  });

  it("import CSV válido (raw text) → 201", async () => {
    const csv = [
      "title,notes,exercise_name,sets,reps,exercise_notes,order",
      "Import CSV Demo,desde CSV,Press banca,3x10,10-12,calent,1",
      "Import CSV Demo,desde CSV,Sentadilla,3x8,8,,2",
    ].join("\n");

    const res = await request(app)
      .post(`/api/routines/import/csv`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/plain")
      .send(csv)
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "Import CSV Demo");
    expect(Array.isArray(res.body.exercises)).toBe(true);
    expect(res.body.exercises.length).toBeGreaterThan(0);
  });

  // ---------- IMPORT (errores esperados) ----------
  it("import CSV sin title en 1ª fila → 400", async () => {
    const csv = [
      "title,notes,exercise_name,sets,reps,exercise_notes,order",
      ",nota,Press banca,3x10,10-12,calent,1",
    ].join("\n");

    await request(app)
      .post(`/api/routines/import/csv`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/plain")
      .send(csv)
      .expect(400);
  });

  it("import CSV con títulos distintos entre filas → 400", async () => {
    const csv = [
      "title,notes,exercise_name,sets,reps,exercise_notes,order",
      "Plan A,nota,Press banca,3x10,10-12,,1",
      "Plan B,nota,Sentadilla,3x8,8,,2",
    ].join("\n");

    await request(app)
      .post(`/api/routines/import/csv`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/plain")
      .send(csv)
      .expect(400);
  });

  it("import JSON con 201 ejercicios (excede límite) → 400", async () => {
    const big = Array.from({ length: 201 }).map((_, i) => ({
      name: `Ej ${i + 1}`,
      sets: "3x10",
      reps: "10",
    }));

    await request(app)
      .post(`/api/routines/import/json`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Too Many",
        notes: "debe fallar por límite",
        exercises: big,
      })
      .expect(400);
  });
});
