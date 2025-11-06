import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prismaClient.js";
import { execSync } from "node:child_process";

describe("Auth flow", () => {
  beforeAll(() => {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  test("register -> login", async () => {
    const email = `demo+${Date.now()}@example.com`;

    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "123456", name: "Demo" })
      .expect(201);

    expect(reg.body.token).toBeDefined();

    const log = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "123456" })
      .expect(200);

    expect(log.body.token).toBeDefined();
  });

  test("register invalid email -> 400", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "mal", password: "123456" })
      .expect(400);
  });
});
