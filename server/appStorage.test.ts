import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadMarineSnapshot, saveEstablishmentImage, saveMarineSnapshot } from "./appStorage";
import type { BeachConditions } from "./beachConditions";

const originalUploadsDirectory = process.env.UPLOADS_DIR;
const originalForgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const originalForgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
let tempDirectory: string | undefined;

afterEach(async () => {
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
  process.env.UPLOADS_DIR = originalUploadsDirectory;
  process.env.BUILT_IN_FORGE_API_URL = originalForgeApiUrl;
  process.env.BUILT_IN_FORGE_API_KEY = originalForgeApiKey;
});

describe("marine snapshot storage", () => {
  it("preserva e recupera a última leitura válida para contingência", async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "to-no-sal-marine-"));
    process.env.UPLOADS_DIR = tempDirectory;
    const snapshot: BeachConditions = {
      updatedAt: "2026-08-14T19:00",
      lastFetchedAt: "2026-08-14T22:00:00.000Z",
      freshness: "fresh",
      waveHeight: 0.4,
      wavePeriod: 4,
      waveDirection: 49,
      seaLevel: 2.2,
      tides: [],
      days: [],
      source: "Open-Meteo",
    };

    await saveMarineSnapshot(snapshot);
    expect(await loadMarineSnapshot()).toEqual(snapshot);
  });

  it("salva a imagem do parceiro no volume e retorna uma URL pública local sem Forge", async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "to-no-sal-uploads-"));
    process.env.UPLOADS_DIR = tempDirectory;
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;

    const result = await saveEstablishmentImage({ userId: 17, fileName: "fachada do parceiro.png", extension: "png", mimeType: "image/png", content: Buffer.from("arquivo-de-teste") });

    expect(result.url).toMatch(/^\/uploads\/establishments\/17\//);
    expect(await readFile(path.join(tempDirectory, result.key), "utf8")).toBe("arquivo-de-teste");
  });
});
