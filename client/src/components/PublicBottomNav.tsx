import { cn } from "@/lib/utils";
import { House, Map, Store, Waves } from "lucide-react";
import { Link, useLocation } from "wouter";

const navigation = [
  { href: "/", label: "Início", icon: House, matches: (path: string) => path === "/" || path.startsWith("/estabelecimento/") },
  { href: "/mapa", label: "Mapa", icon: Map, matches: (path: string) => path === "/mapa" },
  { href: "/ondas-e-mare", label: "Ondas", icon: Waves, matches: (path: string) => path === "/ondas-e-mare" },
  { href: "/parceiro", label: "Parceiro", icon: Store, matches: (path: string) => path === "/parceiro" || path === "/admin" },
];

export default function PublicBottomNav() {
  const [location] = useLocation();
  return <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#0b6976]/10 bg-[#f7f3ea]/95 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-2 sm:py-2 sm:shadow-[0_12px_32px_rgba(6,59,67,0.16)]">
    <div className="mx-auto flex max-w-md items-center justify-around gap-1 sm:min-w-[420px]">{navigation.map(item => {
      const Icon = item.icon;
      const active = item.matches(location);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[0.62rem] font-extrabold transition sm:flex-row sm:justify-center sm:gap-2 sm:rounded-full sm:px-4 sm:py-2 sm:text-xs", active ? "bg-[#073c45] text-white shadow-sm" : "text-[#5b7d82] hover:bg-[#e5f3f0] hover:text-[#073c45]")}><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></Link>;
    })}</div>
  </nav>;
}
