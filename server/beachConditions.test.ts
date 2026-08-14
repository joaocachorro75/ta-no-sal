import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBeachConditions, parseBeachConditions, resetBeachConditionsCacheForTest } from "./beachConditions";

const originalUploadsDirectory = process.env.UPLOADS_DIR;
let tempDirectory: string | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  resetBeachConditionsCacheForTest();
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
  process.env.UPLOADS_DIR = originalUploadsDirectory;
});

describe("parseBeachConditions", () => {
  it("normaliza a resposta marítima e limita a previsão a três dias", () => {
    const result = parseBeachConditions({
      current: { time: "2026-08-14T10:00", wave_height: 1.2, wave_period: 8, wave_direction: 64, sea_level_height_msl: 0.5 },
      daily: { time: ["2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17"], wave_height_max: [1.3, 1.1, 1.6, 1.8], wave_period_max: [8, 7, 9, 10] },
      hourly: { time: ["2026-08-14T01:00", "2026-08-14T02:00", "2026-08-14T03:00", "2026-08-14T04:00", "2026-08-14T05:00"], sea_level_height_msl: [0.2, 0.8, 0.4, 0.1, 0.3] },
    });

    expect(result.waveHeight).toBe(1.2);
    expect(result.days).toHaveLength(3);
    expect(result.days[2]).toEqual({ date: "2026-08-16", waveHeight: 1.6, wavePeriod: 9 });
    expect(result.tides).toEqual([{ type: "alta", time: "2026-08-14T02:00", height: 0.8 }, { type: "baixa", time: "2026-08-14T04:00", height: 0.1 }]);
    expect(result.freshness).toBe("fresh");
    expect(Number.isNaN(Date.parse(result.lastFetchedAt))).toBe(false);
  });

  it("retorna o último snapshot como leitura antiga quando a fonte pública falha", async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "to-no-sal-fallback-"));
    process.env.UPLOADS_DIR = tempDirectory;
    const response = {
      current: { time: "2026-08-14T12:00", wave_height: 0.8, wave_period: 6, wave_direction: 60, sea_level_height_msl: 1.1 },
      daily: { time: ["2026-08-14"], wave_height_max: [0.9], wave_period_max: [7] },
      hourly: { time: ["2026-08-14T00:00", "2026-08-14T01:00", "2026-08-14T02:00"], sea_level_height_msl: [0.3, 0.8, 0.4] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));
    await getBeachConditions();

    resetBeachConditionsCacheForTest();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("source unavailable")));
    const fallback = await getBeachConditions({ forceRefresh: true });

    expect(fallback.freshness).toBe("stale");
    expect(fallback.waveHeight).toBe(0.8);
  });
});
