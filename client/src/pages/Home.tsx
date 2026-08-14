import { Brand } from "@/components/Brand";
import { DirectoryCard, type DirectoryCardItem } from "@/components/DirectoryCard";
import InstallAppButton from "@/components/InstallAppButton";
import PublicBottomNav from "@/components/PublicBottomNav";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Compass, Crosshair, Loader2, MapPin, Sparkles, Store, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Position = { latitude: number; longitude: number };

const heroSlides = [
  { eyebrow: "Salinópolis, Pará", title: "Ache o que resolve seu", accent: "dia de praia.", description: "Comida, mercado, depósito e muito mais em Salinópolis. Encontre o que precisa entre a Atalaia, o Maçarico e onde o seu dia pedir." },
  { eyebrow: "Sua praia, seu ritmo", title: "Do café ao mercadinho,", accent: "tudo por perto.", description: "Descubra parceiros locais para aproveitar Salinas sem perder tempo procurando onde parar, pedir ou comprar." },
  { eyebrow: "Guia local", title: "Mais tempo no mar,", accent: "menos tempo buscando.", description: "Use sua localização e deixe o Tô no Sal organizar o que está mais próximo de você." },
];

function distanceInKm(origin: Position, destination: { latitude: number; longitude: number }) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(origin.latitude)) * Math.cos(toRadians(destination.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withDistance<T extends DirectoryCardItem & { latitude: number; longitude: number }>(items: T[], position: Position | null) {
  return items.map(item => ({ ...item, distance: position ? distanceInKm(position, item) : null })).sort((first, second) => (first.distance ?? Number.POSITIVE_INFINITY) - (second.distance ?? Number.POSITIVE_INFINITY));
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "denied">("idle");
  const [heroSlide, setHeroSlide] = useState(0);
  const directoryInput = useMemo(() => ({ categorySlug: selectedCategory ?? undefined }), [selectedCategory]);
  const { data: categories = [] } = trpc.directory.categories.useQuery();
  const { data: directory = [], isLoading: isDirectoryLoading } = trpc.directory.list.useQuery(directoryInput);
  const { data: featured = [] } = trpc.directory.featured.useQuery();

  const nearbyDirectory = useMemo(() => withDistance(directory, position), [directory, position]);
  const nearbyFeatured = useMemo(() => withDistance(featured, position), [featured, position]);

  const locateVisitor = () => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não oferece geolocalização.");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      value => { setPosition({ latitude: value.coords.latitude, longitude: value.coords.longitude }); setLocationStatus("ready"); toast.success("Ordenamos os locais mais próximos de você."); },
      () => { setLocationStatus("denied"); toast.error("Você pode explorar por categoria mesmo sem compartilhar sua localização."); },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  };

  useEffect(() => { locateVisitor(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setHeroSlide(current => (current + 1) % heroSlides.length), 5500);
    return () => window.clearInterval(timer);
  }, []);
  const currentHero = heroSlides[heroSlide];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f3ea] pb-24 text-[#063b43] sm:pb-32">
      <header className="absolute inset-x-0 top-0 z-20"><div className="container flex h-20 items-center justify-between"><Brand className="[&>div]:hidden sm:[&>div]:block" /><InstallAppButton /></div></header>

      <section className="relative isolate min-h-[405px] overflow-hidden bg-[#dcefed] pb-0 pt-28 sm:min-h-[450px] sm:pt-32">
        <div className="absolute inset-0 -z-10 [background:radial-gradient(circle_at_86%_18%,rgba(255,216,142,0.8),transparent_15%),radial-gradient(circle_at_75%_65%,rgba(43,155,165,0.26),transparent_30%),linear-gradient(120deg,#eff8f5_0%,#d7eeeb_45%,#96d0d3_100%)]" />
        <div className="tide-lines absolute right-[4%] top-[7rem] -z-10 hidden h-36 w-[36rem] opacity-55 lg:block" aria-hidden="true" />
        <div className="absolute -bottom-12 -left-[7%] -z-10 h-48 w-[115%] rotate-[-5deg] rounded-[50%] bg-[#f7f3ea]" />
        <div className="container relative">
          <div className="max-w-3xl pb-16 transition-opacity duration-500"><p className="inline-flex items-center gap-2 rounded-full border border-[#0b6976]/15 bg-white/70 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#0c7d88] backdrop-blur"><Waves className="h-3.5 w-3.5" /> {currentHero.eyebrow}</p><h1 className="mt-6 max-w-2xl font-display text-[clamp(2.8rem,7vw,6.1rem)] font-semibold leading-[0.88] tracking-[-0.065em] text-[#063b43]">{currentHero.title} <span className="text-[#0b8793]">{currentHero.accent}</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-[#426c73] sm:text-lg">{currentHero.description}</p></div>
          <div className="absolute bottom-7 left-4 flex items-center gap-2 sm:left-6"><button onClick={() => setHeroSlide(current => (current - 1 + heroSlides.length) % heroSlides.length)} aria-label="Banner anterior" className="grid h-8 w-8 place-items-center rounded-full border border-[#0b6976]/15 bg-white/70 text-[#0b7e8a] backdrop-blur transition hover:bg-white"><ChevronLeft className="h-4 w-4" /></button><div className="flex gap-1.5">{heroSlides.map((_, index) => <button key={index} onClick={() => setHeroSlide(index)} aria-label={`Ver banner ${index + 1}`} className={`h-2 rounded-full transition-all ${heroSlide === index ? "w-6 bg-[#0b7e8a]" : "w-2 bg-[#0b7e8a]/35"}`} />)}</div><button onClick={() => setHeroSlide(current => (current + 1) % heroSlides.length)} aria-label="Próximo banner" className="grid h-8 w-8 place-items-center rounded-full border border-[#0b6976]/15 bg-white/70 text-[#0b7e8a] backdrop-blur transition hover:bg-white"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
      </section>

      <section className="container relative -mt-6 pb-16 sm:-mt-8 sm:pb-24" id="explorar">
        {nearbyFeatured.length > 0 && <div className="rounded-[1.8rem] bg-[#edf8f6] p-5 shadow-[0_18px_36px_rgba(6,59,67,0.08)] sm:p-7"><div className="mb-5 flex items-end justify-between gap-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffe5aa] text-[#b47318]"><Sparkles className="h-4 w-4" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#d68d20]">Em evidência</p><p className="font-display text-2xl font-semibold tracking-[-0.04em] text-[#063b43]">Destaques da praia</p></div></div><span className="hidden text-xs font-bold text-[#5a7d82] sm:block">Deslize para descobrir</span></div><div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-7 sm:px-7">{nearbyFeatured.map(item => <div key={`featured-${item.id}`} className="snap-start"><DirectoryCard item={item} featured /></div>)}</div></div>}

        <div className="mt-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Navegue do seu jeito</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.045em] text-[#063b43]">O que tem perto?</h2></div>{position && <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f5f2] px-3 py-2 text-xs font-bold text-[#0a7782]"><Compass className="h-3.5 w-3.5" /> Resultados por proximidade</span>}</div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]"><button onClick={() => setSelectedCategory(null)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${!selectedCategory ? "bg-[#073c45] text-white shadow-lg shadow-[#073c45]/15" : "bg-white text-[#37666d] ring-1 ring-[#0b6976]/10 hover:bg-[#eaf5f3]"}`}>Todos</button>{categories.map(category => <button key={category.id} onClick={() => setSelectedCategory(category.slug)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${selectedCategory === category.slug ? "bg-[#073c45] text-white shadow-lg shadow-[#073c45]/15" : "bg-white text-[#37666d] ring-1 ring-[#0b6976]/10 hover:bg-[#eaf5f3]"}`}>{category.name}</button>)}</div>
        <Button variant="outline" onClick={locateVisitor} disabled={locationStatus === "loading"} className="mt-4 h-11 rounded-full border-[#0b7e8a]/25 bg-white px-4 text-sm font-bold text-[#0b7e8a] shadow-sm hover:bg-[#edf8f6]"><Crosshair className={locationStatus === "loading" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{locationStatus === "ready" ? "Localização ativa" : "Usar minha localização"}</Button>

        <div className="mt-10 flex items-center justify-between"><div><p className="font-display text-2xl font-semibold tracking-[-0.04em] text-[#063b43]">Estabelecimentos</p><p className="mt-1 text-sm text-[#6a898d]">{position ? "Ordenados a partir da sua localização." : "Ative a localização para ordenar por distância."}</p></div><span className="hidden rounded-full bg-white px-3 py-2 text-xs font-bold text-[#52747a] ring-1 ring-[#0b6976]/10 sm:block">{nearbyDirectory.length} {nearbyDirectory.length === 1 ? "local" : "locais"}</span></div>
        {isDirectoryLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div> : nearbyDirectory.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{nearbyDirectory.map(item => <DirectoryCard key={item.id} item={item} />)}</div> : <div className="mt-5 rounded-[1.6rem] border border-dashed border-[#8fc7c7] bg-[#eef8f5] p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#0b8793] shadow-sm"><Store className="h-5 w-5" /></span><h3 className="mt-4 font-display text-2xl font-semibold">Ainda não encontramos locais nesta categoria.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5a7d82]">Selecione outra categoria. Novos parceiros entram no Tô no Sal continuamente.</p>{selectedCategory ? <Button variant="outline" onClick={() => setSelectedCategory(null)} className="mt-5 rounded-full border-[#0b7e8a]/25 text-[#0b7e8a]">Ver todas as categorias</Button> : null}</div>}
      </section>

      <footer className="border-t border-[#0b6976]/10 bg-[#073c45] py-10 text-white"><div className="container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><Brand className="[&_p:first-child]:text-white [&_p:last-child]:text-[#a8d9d8]" /><p className="max-w-md text-sm leading-6 text-[#b9d7d5]">A vitrine local para aproveitar Salinópolis com mais praticidade.</p><a href="#explorar" className="inline-flex items-center gap-2 text-sm font-bold text-[#f4cf7c] hover:text-white"><MapPin className="h-4 w-4" /> Explorar Salinópolis</a></div></footer>
      <PublicBottomNav />
    </main>
  );
}
