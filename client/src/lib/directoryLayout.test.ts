import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectoryCard } from "@/components/DirectoryCard";
import { HomeHero } from "@/components/HomeHero";
import { buildHighlightPixRequest, getHighlightStartAt, HighlightAvailabilityCalendar, MonthlyRenewalCard } from "@/pages/PartnerPortal";
import { Router } from "wouter";
import { directoryGridClass, directoryTitleClass, featuredSlideClass, partnerLogoClass, partnerLogoImageClass } from "./directoryLayout";
import { heroImageClass, heroImageUrl, heroOverlayClass, heroSectionClass, heroTitleClass } from "./homePresentation";

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

  it("prioriza a leitura integral do nome do parceiro nos cartões compactos", () => {
    expect(directoryTitleClass).not.toContain("truncate");
    expect(directoryTitleClass).toContain("break-words");
    expect(directoryTitleClass).toContain("min-h");
    expect(directoryTitleClass).toContain("sm:text-[1rem]");
    expect(directoryTitleClass).toContain("lg:text-xl");
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

describe("hero de descoberta", () => {
  it("usa imagem fotográfica do acervo do projeto e conserva contraste sobre o conteúdo", () => {
    expect(heroImageUrl).toMatch(/^\/uploads\/system\/demo-assets\/.+\.png$/);
    expect(heroImageClass).toContain("object-cover");
    expect(heroOverlayClass).toContain("linear-gradient");
  });

  it("mantém escala de hero adequada de celular a desktop", () => {
    expect(heroSectionClass).toContain("min-h-[368px]");
    expect(heroSectionClass).toContain("sm:min-h-[440px]");
    expect(heroSectionClass).toContain("lg:min-h-[500px]");
    expect(heroTitleClass).toContain("text-[2.45rem]");
    expect(heroTitleClass).toContain("sm:text-[clamp(3rem,5vw,4.5rem)]");
    expect(heroTitleClass).toContain("lg:text-[clamp(4rem,5.1vw,5.3rem)]");
  });

  it("renderiza a imagem, a sobreposição e a chamada de descoberta", () => {
    const markup = renderToStaticMarkup(createElement(HomeHero, {
      currentHero: { eyebrow: "Salinópolis, Pará", title: "O que você precisa,", accent: "mais perto.", description: "Parceiros locais." },
      currentSlide: 0,
      totalSlides: 3,
      onPrevious: () => {},
      onNext: () => {},
      onSelect: () => {},
    }));

    expect(markup).toContain(heroImageUrl);
    expect(markup).toContain("Produtos e conveniências locais em Salinópolis");
    expect(markup).toContain("Explorar opções");
    expect(markup).toContain("linear-gradient");
  });
});

describe("renovação mensal automática", () => {
  it("mostra valor, vencimento e envio de comprovante enquanto o pagamento está pendente", () => {
    const markup = renderToStaticMarkup(createElement(MonthlyRenewalCard, { amountCents: 9900, dueAt: new Date("2026-09-10T12:00:00Z"), status: "aguardando_pagamento", onProof: () => {} }));
    expect(markup).toContain("R$ 99,00");
    expect(markup).toContain("10/09/2026");
    expect(markup).toContain("Enviar comprovante");
  });

  it("substitui a ação de upload pelo estado de análise após o envio", () => {
    const markup = renderToStaticMarkup(createElement(MonthlyRenewalCard, { amountCents: 9900, dueAt: new Date("2026-09-10T12:00:00Z"), status: "em_analise", onProof: () => {} }));
    expect(markup).toContain("Comprovante em análise");
    expect(markup).not.toContain("Enviar comprovante");
  });
});

describe("disponibilidade de Destaques", () => {
  const highlightDays = [
    { date: "2026-09-10", endsAt: "2026-09-16", availableSlots: 0, isAvailable: false },
    { date: "2026-09-11", endsAt: "2026-09-17", availableSlots: 2, isAvailable: true },
  ];

  it("expõe datas disponíveis, indisponíveis e vagas restantes no portal do parceiro", () => {
    const markup = renderToStaticMarkup(createElement(HighlightAvailabilityCalendar, { days: highlightDays, selectedDate: "2026-09-11", onSelect: () => {} }));
    expect(markup).toContain("Indisponível");
    expect(markup).toContain("2 vagas");
    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-pressed="true"');
  });

  it("aceita somente uma data disponível para compor o início do PIX", () => {
    expect(getHighlightStartAt(highlightDays, "2026-09-10")).toBeNull();
    expect(getHighlightStartAt(highlightDays, "2026-09-11")?.toISOString()).toBe("2026-09-11T12:00:00.000Z");
  });

  it("integra a seleção do PartnerPortal ao pedido PIX somente quando a data possui vaga", () => {
    expect(buildHighlightPixRequest({ establishmentId: "8", planId: "4", days: highlightDays, selectedDate: "2026-09-10", ownerNote: "Quero aparecer no fim de semana." })).toBeNull();
    expect(buildHighlightPixRequest({ establishmentId: "8", planId: "4", days: highlightDays, selectedDate: "2026-09-11", ownerNote: "Quero aparecer no fim de semana." })).toMatchObject({ establishmentId: 8, planId: 4, ownerNote: "Quero aparecer no fim de semana." });
    expect(buildHighlightPixRequest({ establishmentId: "8", planId: "4", days: highlightDays, selectedDate: "2026-09-11", ownerNote: "" })?.startsAt.toISOString()).toBe("2026-09-11T12:00:00.000Z");
  });
});
