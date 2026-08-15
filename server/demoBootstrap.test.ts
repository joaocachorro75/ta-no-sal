import { describe, expect, it } from "vitest";
import { isDemoAssetSyncCandidate, shouldBootstrapDemoDirectory } from "./db";

describe("bootstrap da vitrine demonstrativa", () => {
  it("cria os dados de demonstração apenas quando não existe nenhum estabelecimento", () => {
    expect(shouldBootstrapDemoDirectory(0)).toBe(true);
    expect(shouldBootstrapDemoDirectory(1)).toBe(false);
    expect(shouldBootstrapDemoDirectory(12)).toBe(false);
  });

  it("migra URLs somente dos registros explicitamente marcados como demonstrativos", () => {
    expect(isDemoAssetSyncCandidate({ slug: "acai-da-vela", isDemo: true })).toBe(true);
    expect(isDemoAssetSyncCandidate({ slug: "acai-da-vela", isDemo: false })).toBe(false);
    expect(isDemoAssetSyncCandidate({ slug: "parceiro-real", isDemo: true })).toBe(false);
  });
});
