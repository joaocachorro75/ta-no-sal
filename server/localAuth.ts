import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../drizzle/schema";

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function getSessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Defina JWT_SECRET com pelo menos 32 caracteres para proteger as sessões.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function createLocalOpenId() {
  return `local:${randomUUID()}`;
}

export async function createLocalSession(user: User) {
  return new SignJWT({ userId: user.id, role: user.role, type: "local" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.openId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifyLocalSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    if (payload.type !== "local" || typeof payload.userId !== "number") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
