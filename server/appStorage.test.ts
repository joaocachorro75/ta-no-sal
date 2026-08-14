import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadMarineSnapshot, saveMarineSnapshot } from "./appStorage";
import type { BeachConditions } from "./beachConditions";

const originalUploadsDirectory = process.env.UPLOADS_DIR;
let tempDirectory: string | undefined;

afterEach(async () => {
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
  process.env.UPLOADS_DIR = originalUploadsDirectory;
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
});
