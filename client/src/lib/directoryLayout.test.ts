import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryCard } from "@/components/DirectoryCard";
import { Router } from "wouter";
import { directoryGridClass, featuredSlideClass, partnerLogoClass, partnerLogoImageClass } from "./directoryLayout";

describe("layout do catálogo", () => {
  it("mantém dois estabelecimentos por linha em toda a experiência móvel", () => {
    expect(directoryGridClass).toContain("grid-cols-2");
    expect(directoryGridClass).not.toContain("grid-cols-1");
  });

  it("mantém um único Destaque por slide e reserva uma área própria para a logomarca", () => {
    expect(featuredSlideClass).toContain("w-full");
    expect(featuredSlideClass).toContain("shrink-0");
    expect(partnerLogoClass).toContain("bottom-3");
    expect(partnerLogoClass).toContain("right-3");
    expect(partnerLogoImageClass).toContain("object-contain");
  });
});

describe("logomarca do parceiro", () => {
  it("renderiza a imagem da logo quando o parceiro possui logoUrl", () => {
    const markup = renderToStaticMarkup(createElement(Router, { hook: () => ["/", () => {}] }, createElement(DirectoryCard, {
      item: {
        id: 1,
        name: "Parceiro com logo",
        slug: "parceiro-com-logo",
        description: "Parceiro usado para validar a apresentação da logomarca.",
        isDeliveryOnly: false,
        categoryName: "Serviços",
        images: ["https://example.com/foto.png"],
        logoUrl: "https://example.com/logo.png",
      },
    })));

    expect(markup).toContain("https://example.com/logo.png");
    expect(markup).toContain("Logomarca de Parceiro com logo");
  });
});
