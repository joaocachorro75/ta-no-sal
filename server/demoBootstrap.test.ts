import { describe, expect, it } from "vitest";
import { shouldBootstrapDemoDirectory } from "./db";

describe("bootstrap da vitrine demonstrativa", () => {
  it("cria os dados de demonstração apenas quando não existe nenhum estabelecimento", () => {
    expect(shouldBootstrapDemoDirectory(0)).toBe(true);
    expect(shouldBootstrapDemoDirectory(1)).toBe(false);
    expect(shouldBootstrapDemoDirectory(12)).toBe(false);
  });
});
