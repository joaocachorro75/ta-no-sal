import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localVisualAssets } from "../shared/demoAssets";
import { bootstrapLocalDemoAssets } from "./demoAssetBootstrap";

const originalUploadsDirectory = process.env.UPLOADS_DIR;
let tempDirectory: string | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
  process.env.UPLOADS_DIR = originalUploadsDirectory;
});

describe("ativos locais demonstrativos", () => {
  it("copia os ativos para o volume e expõe apenas URLs locais ao aplicativo", async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "to-no-sal-demo-assets-"));
    process.env.UPLOADS_DIR = tempDirectory;
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(Buffer.from("imagem"), { headers: { "content-type": "image/webp" } })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await bootstrapLocalDemoAssets();

    expect(result.copied).toBe(result.total);
    expect(fetchMock).toHaveBeenCalledTimes(result.total);
    expect(localVisualAssets.heroImage).toMatch(/^\/uploads\/system\/demo-assets\//);
    expect(await readFile(path.join(tempDirectory, "system/demo-assets/to-no-sal-hero.png"), "utf8")).toBe("imagem");
  });
});
