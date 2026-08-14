import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { storagePut } from "./storage";

export function getUploadsDirectory() {
  return process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
}

function safeBaseName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100) || "imagem";
}

export async function saveEstablishmentImage(input: {
  userId: number;
  fileName: string;
  extension: string;
  mimeType: string;
  content: Buffer;
}) {
  const safeName = safeBaseName(input.fileName.replace(/\.[^.]+$/, ""));
  const relKey = `establishments/${input.userId}/${safeName}.${input.extension}`;

  if (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY) {
    return storagePut(relKey, input.content, input.mimeType);
  }

  const key = `establishments/${input.userId}/${crypto.randomUUID()}-${safeName}.${input.extension}`;
  const absolutePath = path.join(getUploadsDirectory(), key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.content);
  return { key, url: `/uploads/${key}` };
}
