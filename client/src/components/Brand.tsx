import { cn } from "@/lib/utils";
import { publicAssets } from "@/lib/publicAssets";

const brandIcon = publicAssets.brandLogo;

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={brandIcon}
        alt="Símbolo do Tô no Sal: surfista, prancha e onda"
        className="h-11 w-11 shrink-0 object-contain"
      />
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-[1.55rem] font-semibold tracking-[-0.06em] text-[#063b43]">Tô no Sal</p>
          <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#1692a0]">O Aplicativo de Salinas - PA</p>
        </div>
      )}
    </div>
  );
}

export function BeachPlaceholder({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#083f49]", className)} aria-label={label}>
      <div className="absolute inset-0 opacity-90 [background:radial-gradient(circle_at_80%_12%,rgba(255,213,138,0.85),transparent_19%),radial-gradient(circle_at_21%_10%,rgba(83,208,213,0.5),transparent_25%),linear-gradient(155deg,#0a4b57_0%,#0b6875_56%,#78cbd1_100%)]" />
      <div className="absolute -bottom-12 -left-10 h-28 w-[115%] rotate-[-7deg] rounded-[50%] border-t-[18px] border-white/45" />
      <div className="absolute -bottom-16 -left-8 h-28 w-[115%] rotate-[6deg] rounded-[50%] border-t-[16px] border-[#e7b45b]/85" />
    </div>
  );
}
