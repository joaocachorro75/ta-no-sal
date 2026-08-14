import { jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const originalEnvironment = {
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
};

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => {
  process.env.ADMIN_EMAIL = originalEnvironment.adminEmail;
  process.env.ADMIN_PASSWORD = originalEnvironment.adminPassword;
  process.env.JWT_SECRET = originalEnvironment.jwtSecret;
});

describe("adminAccess.login", () => {
  it("emite um token de administrador quando as credenciais configuradas são válidas", async () => {
    process.env.ADMIN_EMAIL = "admin@tonosal.com";
    process.env.ADMIN_PASSWORD = "senha-segura";
    process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";

    const caller = appRouter.createCaller(createAnonymousContext());
    const result = await caller.adminAccess.login({
      email: "ADMIN@TONOSAL.COM",
      password: "senha-segura",
    });

    const verified = await jwtVerify(result.token, new TextEncoder().encode(process.env.JWT_SECRET));
    expect(verified.payload.role).toBe("admin");
    expect(verified.payload.email).toBe("admin@tonosal.com");
  });

  it("rejeita senha ou e-mail inválidos", async () => {
    process.env.ADMIN_EMAIL = "admin@tonosal.com";
    process.env.ADMIN_PASSWORD = "senha-segura";
    process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";

    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.adminAccess.login({ email: "admin@tonosal.com", password: "incorreta" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
