import { heroImageClass, heroImageUrl, heroOverlayClass, heroSectionClass, heroTitleClass } from "@/lib/homePresentation";
import { ChevronLeft, ChevronRight, Waves } from "lucide-react";
import React from "react";

export type HeroSlide = {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
};

type HomeHeroProps = {
  currentHero: HeroSlide;
  currentSlide: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
};

export function HomeHero({ currentHero, currentSlide, totalSlides, onPrevious, onNext, onSelect }: HomeHeroProps) {
  return (
    <section className={heroSectionClass}>
      <img src={heroImageUrl} alt="Produtos e conveniências locais em Salinópolis" className={heroImageClass} />
      <div className={heroOverlayClass} />
      <div className="absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b from-[#063b43]/45 to-transparent" />
      <div className="absolute -bottom-12 -left-[7%] -z-10 h-32 w-[115%] rotate-[-4deg] rounded-[50%] bg-[#f7f3ea]" />
      <div className="container relative">
        <div className="max-w-xl pb-20 transition-opacity duration-500">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white backdrop-blur"><Waves className="h-3.5 w-3.5 text-[#ffe3a0]" /> {currentHero.eyebrow}</p>
          <h1 className={heroTitleClass}>{currentHero.title} <span className="text-[#ffe3a0]">{currentHero.accent}</span></h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/85 sm:text-lg sm:leading-7">{currentHero.description}</p>
          <a href="#explorar" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-[#073c45] shadow-lg shadow-black/20 transition hover:bg-[#ffe3a0]">Explorar opções <ChevronRight className="h-4 w-4" /></a>
        </div>
        <div className="absolute bottom-7 left-4 flex items-center gap-2 sm:left-6">
          <button onClick={onPrevious} aria-label="Banner anterior" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/15 text-white backdrop-blur transition hover:bg-black/30"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex gap-1.5">{Array.from({ length: totalSlides }, (_, index) => <button key={index} onClick={() => onSelect(index)} aria-label={`Ver banner ${index + 1}`} className={`h-2 rounded-full transition-all ${currentSlide === index ? "w-6 bg-white" : "w-2 bg-white/45"}`} />)}</div>
          <button onClick={onNext} aria-label="Próximo banner" className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/15 text-white backdrop-blur transition hover:bg-black/30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}
