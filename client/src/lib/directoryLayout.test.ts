import { describe, expect, it } from "vitest";
import { directoryGridClass, featuredSlideClass, partnerLogoClass, partnerLogoImageClass } from "./directoryLayout";

describe("layout do catálogo", () => {
  it("usa uma coluna antes de uma largura segura e duas a partir de 360 px", () => {
    expect(directoryGridClass).toContain("grid-cols-1");
    expect(directoryGridClass).toContain("min-[360px]:grid-cols-2");
  });

  it("mantém um único Destaque por slide e reserva uma área própria para a logomarca", () => {
    expect(featuredSlideClass).toContain("w-full");
    expect(featuredSlideClass).toContain("shrink-0");
    expect(partnerLogoClass).toContain("bottom-3");
    expect(partnerLogoClass).toContain("right-3");
    expect(partnerLogoImageClass).toContain("object-contain");
  });
});
