import { access, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoEstablishmentAssets, localVisualAssets } from "../shared/demoAssets";
import { getUploadsDirectory } from "./appStorage";

const sources = [
  { url: localVisualAssets.brandLogo, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/jFJmGvSxbMXTlMhL.png" },
  { url: localVisualAssets.appIcon, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/XmGhyfjbDLltWEuU.png" },
  { url: localVisualAssets.heroImage, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/nthktxBRLlDdijeD.png" },
  { url: demoEstablishmentAssets.mareAltaLogo, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/SFtwqntsHGgJXuLb.png" },
  { url: demoEstablishmentAssets.acaiLogo, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/bGkylAZagQKBEJzi.png" },
  { url: demoEstablishmentAssets.mercadoLogo, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/RCMsGhXvLwOlXGay.png" },
  { url: demoEstablishmentAssets.surfCafePhoto, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/KFxlFohjcczJuUGI.webp" },
  { url: demoEstablishmentAssets.acaiBowlPhoto, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/CvSLhrJJAPJYDECX.webp" },
  { url: demoEstablishmentAssets.mercadoPhoto, source: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/EsCkMZxzjpMwviAT.webp" },
] as const;

function getKey(url: string) {
  return url.replace(/^\/uploads\//, "");
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function bootstrapLocalDemoAssets() {
  const uploadsDirectory = getUploadsDirectory();
  let copied = 0;

  for (const asset of sources) {
    const target = path.join(uploadsDirectory, getKey(asset.url));
    if (await exists(target)) continue;

    const response = await fetch(asset.source);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) {
      throw new Error(`Unable to copy local demo asset: ${asset.url}`);
    }

    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, Buffer.from(await response.arrayBuffer()));
    await rename(temporary, target);
    copied += 1;
  }

  return { copied, total: sources.length };
}
