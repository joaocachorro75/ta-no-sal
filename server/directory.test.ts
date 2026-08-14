import { describe, expect, it } from "vitest";
import { createSlug, distanceInKm } from "../shared/directory";

describe("createSlug", () => {
  it("normaliza acentos, espaços e símbolos para URLs públicas", () => {
    expect(createSlug("  Açaí & Sol — Salinópolis! ")).toBe("acai-sol-salinopolis");
  });
});

describe("distanceInKm", () => {
  it("retorna zero para o mesmo ponto", () => {
    expect(distanceInKm(-0.613, -47.355, -0.613, -47.355)).toBe(0);
  });

  it("calcula uma distância aproximada e simétrica entre dois pontos", () => {
    const outbound = distanceInKm(-0.613, -47.355, -0.625, -47.348);
    const returnTrip = distanceInKm(-0.625, -47.348, -0.613, -47.355);

    expect(outbound).toBeGreaterThan(1);
    expect(outbound).toBeLessThan(2);
    expect(returnTrip).toBeCloseTo(outbound, 8);
  });
});
