import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "../shared/const";
import { users } from "../drizzle/schema";
import { getDb, getUserByEmail } from "./db";
import { createContext, type TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const suffix = Date.now();
const email = `local-auth-${suffix}@tonosal.local`;
const password = "senha-local-segura-123";
let userId = 0;
const originalSecret = process.env.JWT_SECRET;

type CookieWrite = { name: string; value: string };

function guestContext() {
  const cookies: CookieWrite[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: () => undefined } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

async function contextFromCookie(token: string) {
  return createContext({
    req: { protocol: "https", headers: { cookie: `${COOKIE_NAME}=${token}` } } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as TrpcContext["res"],
  });
}

describe("integração da autenticação local", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "chave-de-teste-da-sessao-local-com-mais-de-trinta-e-dois-caracteres";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("cria uma conta, emite sessão e permite o fluxo autenticado de usuário e parceiro", async () => {
    const { ctx, cookies } = guestContext();
    const guestCaller = appRouter.createCaller(ctx);
    const registered = await guestCaller.auth.register({ name: "Conta Local", email, password });
    expect(registered.user).toMatchObject({ email, role: "user" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    userId = registered.user.id;

    const sessionContext = await contextFromCookie(cookies[0]!.value);
    expect(sessionContext.user).toMatchObject({ id: userId, email, role: "user" });
    const userCaller = appRouter.createCaller(sessionContext);
    await expect(userCaller.account.favoriteIds()).resolves.toEqual([]);
    await expect(userCaller.owner.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });

    await userCaller.owner.enroll();
    const ownerContext = await contextFromCookie(cookies[0]!.value);
    expect(ownerContext.user?.role).toBe("owner");
    await expect(appRouter.createCaller(ownerContext).owner.overview()).resolves.toBeDefined();
    await expect(appRouter.createCaller(ownerContext).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aceita login com senha local e identifica o administrador pelo token local", async () => {
    const { ctx, cookies } = guestContext();
    const login = await appRouter.createCaller(ctx).auth.login({ email, password });
    expect(login.user.id).toBe(userId);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);

    const originalEmail = process.env.ADMIN_EMAIL;
    const originalPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = `admin-${suffix}@tonosal.local`;
    process.env.ADMIN_PASSWORD = "admin-local-segura";
    try {
      const adminToken = await appRouter.createCaller(guestContext().ctx).adminAccess.login({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
      const adminContext = await createContext({
        req: { protocol: "https", headers: { authorization: `Bearer tns-local.${adminToken.token}` } } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });
      expect(adminContext.user?.role).toBe("admin");
      await expect(appRouter.createCaller(adminContext).admin.overview()).resolves.toBeDefined();
    } finally {
      process.env.ADMIN_EMAIL = originalEmail;
      process.env.ADMIN_PASSWORD = originalPassword;
    }
  });
});

afterAll(async () => {
  const db = await getDb();
  if (db && userId) await db.delete(users).where(eq(users.id, userId));
  if (!userId) {
    const user = await getUserByEmail(email);
    if (db && user) await db.delete(users).where(eq(users.id, user.id));
  }
});
