import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Building2, CheckCircle2, Loader2, LogIn, Store } from "lucide-react";
import React from "react";
import { Link, useLocation } from "wouter";

export const partnerSignupPath = "/cadastre-estabelecimento";

export default function PartnerSignup() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const enroll = trpc.owner.enroll.useMutation({ onSuccess: () => navigate("/parceiro") });

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f3ea]"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></main>;

  if (!user) return <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#063b43]"><section className="mx-auto max-w-2xl rounded-[2rem] bg-white p-6 shadow-[0_20px_50px_rgba(6,59,67,0.11)] ring-1 ring-[#0b6976]/10 sm:p-10"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#edf7f5] text-[#0b7e8a]"><Store className="h-6 w-6" /></span><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Para parceiros locais</p><h1 className="mt-2 font-display text-4xl leading-tight tracking-[-0.05em]">Cadastre seu estabelecimento no Tô no Sal</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#5b7d82]">Entre ou crie sua conta para informar o seu negócio, receber a cobrança PIX inicial e acompanhar a confirmação. Se já for parceiro, use a mesma conta para acessar seu painel.</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{["Crie ou entre na conta", "Cadastre seu estabelecimento", "Envie o PIX e entre no ar"].map((step, index) => <div key={step} className="rounded-2xl bg-[#edf8f6] p-4"><span className="text-xs font-extrabold text-[#0b7e8a]">0{index + 1}</span><p className="mt-2 text-sm font-bold leading-5 text-[#164e57]">{step}</p></div>)}</div><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button onClick={() => startLogin(partnerSignupPath)} className="h-11 rounded-full bg-[#073c45] px-5 text-white hover:bg-[#0a5964]"><LogIn className="h-4 w-4" />Criar conta ou entrar</Button><Link href="/" className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-[#0b7e8a] hover:bg-[#edf8f6]">Voltar para explorar</Link></div></section></main>;

  if (user.role === "owner" || user.role === "admin") return <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#063b43]"><section className="mx-auto max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_50px_rgba(6,59,67,0.11)] ring-1 ring-[#0b6976]/10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ddf5e8] text-[#17734d]"><CheckCircle2 className="h-7 w-7" /></span><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Conta reconhecida</p><h1 className="mt-2 font-display text-3xl">Você já é parceiro do Tô no Sal</h1><p className="mt-3 text-sm leading-6 text-[#5b7d82]">Acesse seu painel para cadastrar outro estabelecimento, editar informações, acompanhar a mensalidade ou contratar Destaques.</p><Button onClick={() => navigate("/parceiro")} className="mt-7 h-11 rounded-full bg-[#073c45] px-5 text-white hover:bg-[#0a5964]"><Building2 className="h-4 w-4" />Ir para meu painel</Button></section></main>;

  return <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#063b43]"><section className="mx-auto max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_50px_rgba(6,59,67,0.11)] ring-1 ring-[#0b6976]/10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf7f5] text-[#0b7e8a]"><Store className="h-7 w-7" /></span><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Sua conta está pronta</p><h1 className="mt-2 font-display text-3xl">Vamos cadastrar seu estabelecimento</h1><p className="mt-3 text-sm leading-6 text-[#5b7d82]">Ative seu perfil de parceiro para abrir o formulário completo do negócio. Você poderá informar fotos, logomarca, WhatsApp, endereço e modalidade de atendimento.</p><Button onClick={() => enroll.mutate()} disabled={enroll.isPending} className="mt-7 h-11 rounded-full bg-[#073c45] px-5 text-white hover:bg-[#0a5964]">{enroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Continuar para o cadastro</Button></section></main>;
}
