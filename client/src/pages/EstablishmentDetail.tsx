import { BeachPlaceholder, Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ChevronLeft, ChevronRight, ImageOff, MapPin, Navigation, Phone, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

function whatsappUrl(value: string) {
  return `https://wa.me/${value.replace(/\D/g, "")}`;
}

export default function EstablishmentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: establishment, isLoading, isError } = trpc.directory.detail.useQuery({ slug });
  const [activeImage, setActiveImage] = useState(0);
  const gallery = useMemo(() => establishment?.images.slice(0, 6) ?? [], [establishment?.images]);

  useEffect(() => setActiveImage(0), [slug]);

  if (isLoading) {
    return <div className="min-h-screen bg-[#f7f3ea] p-6"><div className="mx-auto h-[80vh] max-w-5xl animate-pulse rounded-[2rem] bg-[#d9ebe8]" /></div>;
  }

  if (isError || !establishment) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f3ea] p-6 text-center">
        <div><Brand className="justify-center" /><h1 className="mt-10 font-display text-3xl text-[#063b43]">Este lugar não está disponível agora.</h1><Link href="/" className="mt-6 inline-flex rounded-full bg-[#073c45] px-5 py-3 text-sm font-bold text-white">Voltar para explorar</Link></div>
      </main>
    );
  }

  const address = [establishment.streetAddress, establishment.neighborhood, establishment.city].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${establishment.latitude},${establishment.longitude}`;
  const previous = () => setActiveImage(current => (current - 1 + gallery.length) % gallery.length);
  const next = () => setActiveImage(current => (current + 1) % gallery.length);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#063b43]">
      <header className="sticky top-0 z-20 border-b border-[#0b6976]/10 bg-[#f7f3ea]/92 backdrop-blur-xl">
        <div className="container flex h-[4.7rem] items-center justify-between"><Link href="/" aria-label="Voltar ao início"><Brand compact /></Link><Button variant="ghost" size="sm" onClick={() => navigator.share?.({ title: establishment.name, url: window.location.href }).catch(() => toast("Link pronto para compartilhar"))} className="rounded-full text-[#0b6976]"><Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span></Button></div>
      </header>

      <div className="container max-w-6xl py-7 sm:py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#0b7e8a] transition hover:text-[#073c45]"><ArrowLeft className="h-4 w-4" /> Voltar para descobrir</Link>
        <div className="mt-6 grid overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_60px_rgba(6,59,67,0.12)] lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative min-h-[330px] bg-[#073c45] sm:min-h-[490px]">
            {gallery.length ? <img src={gallery[activeImage]?.imageUrl} alt={gallery[activeImage]?.altText || `Foto de ${establishment.name}`} className="absolute inset-0 h-full w-full object-cover" /> : <BeachPlaceholder className="absolute inset-0" label="Galeria ainda sem fotos" />}
            {!gallery.length && <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-[#073c45]/55 p-5 text-sm font-medium text-white"><ImageOff className="h-4 w-4" /> Fotos deste estabelecimento serão exibidas aqui.</div>}
            {gallery.length > 1 && <><button onClick={previous} aria-label="Foto anterior" className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#063b43] shadow-md transition hover:bg-white"><ChevronLeft className="h-5 w-5" /></button><button onClick={next} aria-label="Próxima foto" className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#063b43] shadow-md transition hover:bg-white"><ChevronRight className="h-5 w-5" /></button><div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-[#063b43]/60 px-3 py-2 backdrop-blur"><span className="text-xs font-bold text-white">{activeImage + 1} / {gallery.length}</span></div></>}
          </section>
          <section className="flex flex-col p-7 sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#d68d20]">{establishment.categoryName}</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.045em] text-[#063b43] sm:text-5xl">{establishment.name}</h1>
            <p className="mt-6 text-base leading-7 text-[#4d6e74]">{establishment.description}</p>
            {!establishment.isDeliveryOnly && <div className="mt-7 flex items-start gap-3 rounded-2xl bg-[#edf7f5] p-4 text-sm text-[#38656c]"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d99023]" /><span>{address || "Salinópolis, Pará"}</span></div>}
            {establishment.isDeliveryOnly && <div className="mt-7 rounded-2xl bg-[#fff3d8] p-4 text-sm font-medium text-[#805e20]">Este estabelecimento atende somente por entrega.</div>}
            <div className="mt-auto grid gap-3 pt-8"><a href={whatsappUrl(establishment.whatsapp)} target="_blank" rel="noreferrer"><Button className="h-12 w-full rounded-full bg-[#0e916e] text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(14,145,110,0.25)] transition hover:bg-[#087454]"><Phone className="h-4 w-4" /> Chamar no WhatsApp</Button></a>{!establishment.isDeliveryOnly && <a href={mapsUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="h-12 w-full rounded-full border-[#0b7e8a]/25 bg-transparent text-sm font-extrabold text-[#0a6874] hover:bg-[#ecf8f6]"><Navigation className="h-4 w-4" /> Como Chegar</Button></a>}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
