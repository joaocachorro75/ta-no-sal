import { Brand } from "@/components/Brand";
import SurfMap from "@/components/SurfMap";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Crosshair, Loader2, Map as MapIcon, Navigation } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type Position = { latitude: number; longitude: number };

export default function MapPage() {
  const [position, setPosition] = useState<Position | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const { data: places = [], isLoading } = trpc.directory.list.useQuery();
  const locate = () => {
    if (!navigator.geolocation) return toast.error("Seu navegador não oferece geolocalização.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      current => { setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude }); setIsLocating(false); toast.success("Sua posição está no mapa."); },
      () => { setIsLocating(false); toast.error("Você pode explorar o mapa sem compartilhar sua localização."); },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  };

  return <main className="min-h-screen bg-[#f7f3ea] text-[#063b43]"><header className="border-b border-[#0b6976]/10 bg-[#f7f3ea]/92 backdrop-blur-xl"><div className="container flex h-20 items-center justify-between"><Link href="/" aria-label="Tô no Sal"><Brand compact /></Link><nav className="flex items-center gap-2"><Link href="/ondas-e-mare" className="rounded-full px-3 py-2 text-xs font-bold text-[#0b7e8a] hover:bg-[#eaf5f3]">Ondas e Maré</Link><Link href="/admin" className="rounded-full border border-[#0b6876]/15 bg-white px-3 py-2 text-xs font-bold text-[#0b6876]">Área do parceiro</Link></nav></div></header><div className="container max-w-6xl py-8 sm:py-12"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#0b7e8a]"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Link><section className="mt-6 grid gap-6 lg:grid-cols-[0.62fr_1.38fr]"><div className="rounded-[1.7rem] bg-[#073c45] p-7 text-white sm:p-9"><p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.17em] text-[#f4cf7c]"><MapIcon className="h-3.5 w-3.5" /> Mapa local</p><h1 className="mt-3 font-display text-5xl leading-[0.92] tracking-[-0.055em]">Tudo em Salinas, no seu ritmo.</h1><p className="mt-5 text-sm leading-7 text-[#b9d7d5]">Veja os parceiros do Tô no Sal pela cidade. Toque em um ponto para abrir o estabelecimento e, se quiser, inclua a sua posição no mapa.</p><Button onClick={locate} disabled={isLocating} className="mt-7 h-11 rounded-full bg-[#f4cf7c] text-[#073c45] hover:bg-[#ffe3a0]"><Crosshair className={isLocating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{position ? "Localização ativa" : "Usar minha localização"}</Button><p className="mt-5 flex items-center gap-2 text-xs text-[#a8d9d8]"><Navigation className="h-3.5 w-3.5 text-[#f4cf7c]" />{places.length} locais disponíveis no mapa</p></div><div>{isLoading ? <div className="grid min-h-[460px] place-items-center rounded-[1.6rem] bg-white"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div> : <SurfMap places={places} position={position} />}</div></section></div></main>;
}
