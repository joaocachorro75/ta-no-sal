import { Brand } from "@/components/Brand";
import BeachConditions from "@/components/BeachConditions";
import PublicBottomNav from "@/components/PublicBottomNav";
import { ArrowLeft, Map, Waves } from "lucide-react";
import { Link } from "wouter";

export default function BeachPage() {
  return <main className="min-h-screen bg-[#f7f3ea] pb-24 text-[#063b43] sm:pb-32"><header className="border-b border-[#0b6976]/10 bg-[#f7f3ea]/92 backdrop-blur-xl"><div className="container flex h-20 items-center justify-between"><Link href="/" aria-label="Tô no Sal"><Brand compact /></Link><span className="rounded-full bg-[#e7f4f1] px-3 py-2 text-xs font-extrabold text-[#0b7e8a]">Guia de praia</span></div></header><div className="container max-w-6xl py-8 sm:py-12"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#0b7e8a]"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Link><section className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]"><div className="rounded-[1.7rem] bg-[#e1f2ef] p-7 sm:p-9"><p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]"><Waves className="h-3.5 w-3.5" /> Guia de praia</p><h1 className="mt-3 font-display text-5xl leading-[0.92] tracking-[-0.055em] text-[#063b43]">Ondas e maré para o seu dia em Salinas.</h1><p className="mt-5 text-sm leading-7 text-[#527177]">Acompanhe a previsão marítima do mar próximo à costa antes de sair. As informações são uma referência de praia, não um instrumento de navegação.</p><Link href="/mapa" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#073c45] px-4 py-2.5 text-sm font-bold text-white"><Map className="h-4 w-4" /> Ver parceiros no mapa</Link></div><BeachConditions /></section></div><PublicBottomNav /></main>;
}
