import { cn } from "@/lib/utils";
import { Building2, House, Images, Map, Store, Waves } from "lucide-react";
import { Link, useLocation } from "wouter";

const navigation = [
  { href: "/", label: "Início", icon: House, matches: (path: string) => path === "/" || path.startsWith("/estabelecimento/") },
  { href: "/imoveis", label: "Imóveis", icon: Building2, matches: (path: string) => path.startsWith("/imoveis") },
  { href: "/mural", label: "Mural", icon: Images, matches: (path: string) => path.startsWith("/mural") },
  { href: "/mapa", label: "Mapa", icon: Map, matches: (path: string) => path === "/mapa" },
  { href: "/ondas-e-mare", label: "Ondas", icon: Waves, matches: (path: string) => path === "/ondas-e-mare" },
  { href: "/cadastre-estabelecimento", label: "Cadastrar", icon: Store, matches: (path: string) => path === "/cadastre-estabelecimento" || path === "/parceiro" || path === "/admin" },
];

export default function PublicBottomNav() {
  const [location] = useLocation();
  return <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#0b6976]/10 bg-[#f7f3ea]/95 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-2 sm:py-2 sm:shadow-[0_12px_32px_rgba(6,59,67,0.16)]">
    <div className="mx-auto flex max-w-full items-center justify-around gap-1 overflow-x-auto [scrollbar-width:none] sm:min-w-[620px]">{navigation.map(item => {
      const Icon = item.icon;
      const active = item.matches(location);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-w-[3.65rem] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[0.62rem] font-extrabold transition sm:min-w-0 sm:flex-row sm:justify-center sm:gap-2 sm:rounded-full sm:px-4 sm:py-2 sm:text-xs", active ? "bg-[#073c45] text-white shadow-sm" : "text-[#5b7d82] hover:bg-[#e5f3f0] hover:text-[#073c45]")}><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></Link>;
    })}</div>
  </nav>;
}
