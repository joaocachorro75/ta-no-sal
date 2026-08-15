import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardMenuItem } from "@/components/DashboardLayout";
import { DirectoryCard } from "@/components/DirectoryCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Heart, Loader2, Store } from "lucide-react";
import { Link } from "wouter";

const accountNavigation: DashboardMenuItem[] = [{ icon: Heart, label: "Meus favoritos", path: "/conta" }];

function AccountContent() {
  const { user } = useAuth();
  const { data: favorites = [], isLoading } = trpc.account.favorites.useQuery(undefined, { enabled: Boolean(user) });

  if (isLoading) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div>;

  return <div className="mx-auto max-w-6xl pb-12"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Sua conta</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.045em] text-[#063b43]">Meus favoritos</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#5b7d82]">Guarde os locais que você quer consultar novamente em Salinópolis.</p></div><Link href="/parceiro"><Button variant="outline" className="rounded-full border-[#0b7e8a]/25 text-[#0b7e8a]"><Store className="h-4 w-4" /> Tenho um estabelecimento</Button></Link></div>{favorites.length ? <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">{favorites.map(item => <DirectoryCard key={item.id} item={item} />)}</div> : <div className="mt-8 grid min-h-64 place-items-center rounded-[1.75rem] border border-dashed border-[#9bc9c4] bg-[#edf8f6] p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#d99023] shadow-sm"><Heart className="h-5 w-5" /></span><h2 className="mt-4 font-display text-2xl text-[#063b43]">Ainda não há favoritos.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5b7d82]">Abra um estabelecimento e toque no coração para guardar o local nesta lista.</p><Link href="/"><Button className="mt-5 rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]">Explorar estabelecimentos</Button></Link></div></div>}</div>;
}

export default function Account() { return <DashboardLayout navigation={accountNavigation}><AccountContent /></DashboardLayout>; }
