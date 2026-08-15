import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { verifyLocalSession } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function getLocalAdminUser(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  const authorization = req.headers.authorization;
  const prefix = "Bearer tns-local.";
  if (!authorization?.startsWith(prefix) || !process.env.JWT_SECRET) return null;

  try {
    const token = authorization.slice(prefix.length);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    if (payload.role !== "admin" || typeof payload.email !== "string") return null;
    const now = new Date();
    return {
      id: 0,
      openId: `local-admin:${payload.email}`,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "Administrador",
      passwordHash: null,
      loginMethod: "local-admin",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  } catch {
    return null;
  }
}

async function getLocalSessionUser(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;
  const session = await verifyLocalSession(token);
  if (!session) return null;
  return (await db.getUserById(session.userId)) ?? null;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const user = (await getLocalAdminUser(opts.req)) ?? (await getLocalSessionUser(opts.req));
  return { req: opts.req, res: opts.res, user };
}
