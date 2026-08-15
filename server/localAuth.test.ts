import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { createLocalOpenId, createLocalSession, hashPassword, verifyLocalSession, verifyPassword } from "./localAuth";

const originalSecret = process.env.JWT_SECRET;
const user: User = {
  id: 42,
  openId: "local:test-user",
  name: "Pessoa Teste",
  email: "teste@sal.local",
  passwordHash: null,
  loginMethod: "local",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

beforeEach(() => {
  process.env.JWT_SECRET = "uma-chave-de-sessao-local-com-mais-de-trinta-e-dois-caracteres";
});

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
});

describe("autenticação local", () => {
  it("gera hash de senha verificável sem guardar a senha em texto", async () => {
    const hash = await hashPassword("senha-segura-123");
    expect(hash).toMatch(/^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
    expect(hash).not.toContain("senha-segura-123");
    await expect(verifyPassword("senha-segura-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("senha-incorreta", hash)).resolves.toBe(false);
  });

  it("emite e valida uma sessão local vinculada ao usuário", async () => {
    const token = await createLocalSession(user);
    await expect(verifyLocalSession(token)).resolves.toEqual({ userId: 42 });
  });

  it("cria identificadores locais sem depender de provedor externo", () => {
    expect(createLocalOpenId()).toMatch(/^local:[0-9a-f-]{36}$/);
  });
});
