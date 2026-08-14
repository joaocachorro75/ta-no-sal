import { describe, expect, it } from "vitest";
import { parseBeachConditions } from "./beachConditions";

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
  });
});
