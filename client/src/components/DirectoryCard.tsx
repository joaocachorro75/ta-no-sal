import { BeachPlaceholder } from "@/components/Brand";
import { partnerLogoClass, partnerLogoImageClass } from "@/lib/directoryLayout";
import { cn } from "@/lib/utils";
import { ChevronRight, MapPin, PackageCheck, Sparkles } from "lucide-react";
import React from "react";
import { Link } from "wouter";

export type DirectoryCardItem = {
  id: number;
  name: string;
  slug: string;
  description: string;
  streetAddress?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  isDeliveryOnly: boolean;
  categoryName: string;
  categoryIcon?: string | null;
  images: string[];
  distance?: number | null;
  planLabel?: string;
  isDemo?: boolean;
  logoUrl?: string | null;
};

export function formatDistance(distance?: number | null) {
  if (distance === undefined || distance === null) return "Localização disponível";
  if (distance < 1) return `${Math.max(50, Math.round(distance * 1000 / 50) * 50)} m de você`;
  return `${distance.toFixed(distance < 10 ? 1 : 0).replace(".", ",")} km de você`;
}

export function DirectoryCard({ item, featured = false }: { item: DirectoryCardItem; featured?: boolean }) {
  const address = [item.neighborhood, item.streetAddress].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/estabelecimento/${item.slug}`}
      className={cn(
        "group block overflow-hidden rounded-[1.4rem] bg-white shadow-[0_16px_34px_rgba(6,59,67,0.09)] ring-1 ring-[#0b6976]/8 transition duration-200 hover:-translate-y-1 hover:shadow-[0_21px_43px_rgba(6,59,67,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e7a53f]",
        featured && "min-w-full",
      )}
    >
      <div className="relative aspect-[1.32/1] overflow-hidden">
        {item.images[0] ? (
          <img src={item.images[0]} alt={`Foto de ${item.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <BeachPlaceholder className="h-full w-full" label={`Imagem de ${item.name} ainda não cadastrada`} />
        )}
        {featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#ffe3a0] px-2.5 py-1 text-[0.63rem] font-extrabold uppercase tracking-[0.12em] text-[#694709] shadow-sm">
            <Sparkles className="h-3 w-3" /> Destaque {item.planLabel ? `· ${item.planLabel}` : ""}
          </span>
        )}
        {item.isDemo && <span className="absolute right-[-2.9rem] top-5 rotate-45 bg-[#f4cf7c] px-10 py-1 text-[0.56rem] font-extrabold uppercase tracking-[0.12em] text-[#5a3b0b] shadow-sm">Estabelecimento demo</span>}
        <span className="absolute bottom-3 left-3 rounded-full bg-[#073c45]/85 px-2.5 py-1 text-[0.64rem] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
          {item.categoryName}
        </span>
        {item.logoUrl ? (
          <span className={partnerLogoClass} aria-label={`Logomarca de ${item.name}`}>
            <img src={item.logoUrl} alt={`Logomarca de ${item.name}`} className={partnerLogoImageClass} />
          </span>
        ) : null}
      </div>
      <div className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[1.05rem] font-semibold tracking-[-0.025em] text-[#063b43] sm:text-xl">{item.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#527177] sm:text-sm">{item.description}</p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#12909f] transition-transform group-hover:translate-x-0.5 sm:mt-1 sm:h-5 sm:w-5" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e4efed] pt-2.5 text-[0.68rem] font-semibold text-[#467278] sm:mt-4 sm:pt-3 sm:text-xs">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {item.isDeliveryOnly ? <PackageCheck className="h-3.5 w-3.5 shrink-0 text-[#d99123]" /> : <MapPin className="h-3.5 w-3.5 shrink-0 text-[#d99123]" />}
            <span className="truncate">{item.isDeliveryOnly ? "Atendimento por entrega" : address || item.city || "Salinópolis"}</span>
          </span>
          <span className="shrink-0 text-[#0c7d88]">{formatDistance(item.distance)}</span>
        </div>
      </div>
    </Link>
  );
}
