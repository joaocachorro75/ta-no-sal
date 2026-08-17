import { Brand } from "@/components/Brand";
import { DirectoryCard, type DirectoryCardItem } from "@/components/DirectoryCard";
import { HomeHero, type HeroSlide } from "@/components/HomeHero";
import InstallAppButton from "@/components/InstallAppButton";
import PublicBottomNav from "@/components/PublicBottomNav";
import { Button } from "@/components/ui/button";
import { directoryGridClass, featuredSlideClass } from "@/lib/directoryLayout";
import { trpc } from "@/lib/trpc";
import { Compass, Crosshair, Loader2, MapPin, Sparkles, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Position = { latitude: number; longitude: number };

const heroSlides: HeroSlide[] = [
  { eyebrow: "Salinópolis, Pará", title: "O que você precisa,", accent: "mais perto.", description: "Comida, mercado, serviços e conveniência no seu bairro." },
  { eyebrow: "Sua cidade, seu ritmo", title: "Descubra o melhor", accent: "do seu caminho.", description: "Parceiros locais para resolver a rotina sem perder tempo procurando." },
  { eyebrow: "Encontre tudo que quiser", title: "Salinas inteira", accent: "na sua mão.", description: "Use sua localização e encontre opções perto de você." },
];

function distanceInKm(origin: Position, destination: { latitude: number; longitude: number }) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(toRadians(origin.latitude)) * Math.cos(toRadians(destination.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withDistance<T extends DirectoryCardItem & { latitude: number | null; longitude: number | null }>(items: T[], position: Position | null) {
  return items.map(item => ({ ...item, distance: position && item.latitude !== null && item.longitude !== null ? distanceInKm(position, { latitude: item.latitude, longitude: item.longitude }) : null })).sort((first, second) => (first.distance ?? Number.POSITIVE_INFINITY) - (second.distance ?? Number.POSITIVE_INFINITY));
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
      <header className="absolute inset-x-0 top-0 z-20"><div className="container flex h-20 items-center justify-between gap-2"><div className="rounded-full bg-white/90 px-3 py-2 shadow-lg shadow-[#063b43]/10 backdrop-blur"><Brand className="[&>div]:hidden sm:[&>div]:block" /></div><InstallAppButton /></div></header>

      <HomeHero currentHero={currentHero} currentSlide={heroSlide} totalSlides={heroSlides.length} onPrevious={() => setHeroSlide(current => (current - 1 + heroSlides.length) % heroSlides.length)} onNext={() => setHeroSlide(current => (current + 1) % heroSlides.length)} onSelect={setHeroSlide} />

      <section className="container relative -mt-6 pb-16 sm:-mt-8 sm:pb-24" id="explorar">
        {nearbyFeatured.length > 0 && <div className="rounded-[1.8rem] bg-[#edf8f6] p-5 shadow-[0_18px_36px_rgba(6,59,67,0.08)] sm:p-7"><div className="mb-5 flex items-end justify-between gap-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffe5aa] text-[#b47318]"><Sparkles className="h-4 w-4" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#d68d20]">Em evidência</p><p className="font-display text-2xl font-semibold tracking-[-0.04em] text-[#063b43]">Destaques do Sal</p></div></div><span className="hidden text-xs font-bold text-[#5a7d82] sm:block">Deslize para descobrir</span></div><div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-7 sm:px-7">{nearbyFeatured.map(item => <div key={`featured-${item.id}`} className={featuredSlideClass}><DirectoryCard item={item} featured /></div>)}</div></div>}

        <div className="mt-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Navegue do seu jeito</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.045em] text-[#063b43]">O que tem perto?</h2></div>{position && <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f5f2] px-3 py-2 text-xs font-bold text-[#0a7782]"><Compass className="h-3.5 w-3.5" /> Resultados por proximidade</span>}</div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]"><button onClick={() => setSelectedCategory(null)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${!selectedCategory ? "bg-[#073c45] text-white shadow-lg shadow-[#073c45]/15" : "bg-white text-[#37666d] ring-1 ring-[#0b6976]/10 hover:bg-[#eaf5f3]"}`}>Todos</button>{categories.map(category => <button key={category.id} onClick={() => setSelectedCategory(category.slug)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${selectedCategory === category.slug ? "bg-[#073c45] text-white shadow-lg shadow-[#073c45]/15" : "bg-white text-[#37666d] ring-1 ring-[#0b6976]/10 hover:bg-[#eaf5f3]"}`}>{category.name}</button>)}</div>
        <Button variant="outline" onClick={locateVisitor} disabled={locationStatus === "loading"} className="mt-4 h-11 rounded-full border-[#0b7e8a]/25 bg-white px-4 text-sm font-bold text-[#0b7e8a] shadow-sm hover:bg-[#edf8f6]"><Crosshair className={locationStatus === "loading" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{locationStatus === "ready" ? "Localização ativa" : "Usar minha localização"}</Button>

        <div className="mt-10 flex items-center justify-between"><div><p className="font-display text-2xl font-semibold tracking-[-0.04em] text-[#063b43]">Estabelecimentos</p><p className="mt-1 text-sm text-[#6a898d]">{position ? "Ordenados a partir da sua localização." : "Ative a localização para ordenar por distância."}</p></div><span className="hidden rounded-full bg-white px-3 py-2 text-xs font-bold text-[#52747a] ring-1 ring-[#0b6976]/10 sm:block">{nearbyDirectory.length} {nearbyDirectory.length === 1 ? "local" : "locais"}</span></div>
        {isDirectoryLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div> : nearbyDirectory.length ? <div className={directoryGridClass}>{nearbyDirectory.map(item => <DirectoryCard key={item.id} item={item} />)}</div> : <div className="mt-5 rounded-[1.6rem] border border-dashed border-[#8fc7c7] bg-[#eef8f5] p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#0b8793] shadow-sm"><Store className="h-5 w-5" /></span><h3 className="mt-4 font-display text-2xl font-semibold">Ainda não encontramos locais nesta categoria.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5a7d82]">Selecione outra categoria. Novos parceiros entram no Tô no Sal continuamente.</p>{selectedCategory ? <Button variant="outline" onClick={() => setSelectedCategory(null)} className="mt-5 rounded-full border-[#0b7e8a]/25 text-[#0b7e8a]">Ver todas as categorias</Button> : null}</div>}
      </section>

      <footer className="border-t border-[#0b6976]/10 bg-[#073c45] py-10 text-white"><div className="container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><Brand className="[&_p:first-child]:text-white [&_p:last-child]:text-[#a8d9d8]" /><p className="max-w-md text-sm leading-6 text-[#b9d7d5]">A vitrine local para aproveitar Salinópolis com mais praticidade.</p><a href="#explorar" className="inline-flex items-center gap-2 text-sm font-bold text-[#f4cf7c] hover:text-white"><MapPin className="h-4 w-4" /> Explorar Salinópolis</a></div></footer>
      <PublicBottomNav />
    </main>
  );
}
