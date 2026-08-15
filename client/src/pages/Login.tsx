import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localLoginPath } from "@/lib/localAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, LogIn, UserPlus, Waves } from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation } from "wouter";

function returnPath() {
  const value = new URLSearchParams(window.location.search).get("retorno") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const destination = returnPath();
  const complete = async () => {
    await utils.auth.me.invalidate();
    navigate(destination);
  };
  const login = trpc.auth.login.useMutation({ onSuccess: complete });
  const register = trpc.auth.register.useMutation({ onSuccess: complete });
  const pending = login.isPending || register.isPending;
  const error = login.error?.message ?? register.error?.message;

  return <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#063b43] sm:py-16"><section className="mx-auto max-w-md overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_60px_rgba(6,59,67,0.13)] ring-1 ring-[#0b6976]/10"><div className="bg-[#063b43] px-7 py-8 text-white"><Waves className="h-7 w-7 text-[#f4cf7c]" /><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#f4cf7c]">Tô no Sal</p><h1 className="mt-2 font-display text-3xl tracking-[-0.04em]">{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h1><p className="mt-3 text-sm leading-6 text-white/75">{mode === "login" ? "Acesse favoritos, seu estabelecimento e pagamentos." : "Uma conta única para favoritos e para cadastrar seu negócio."}</p></div><form className="space-y-5 p-7" onSubmit={event => { event.preventDefault(); if (mode === "login") login.mutate({ email, password }); else register.mutate({ name, email, password }); }}>
    {mode === "register" && <div className="space-y-2"><Label htmlFor="name">Seu nome</Label><Input id="name" value={name} onChange={event => setName(event.target.value)} minLength={2} required /></div>}
    <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>
    <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} required /><p className="text-xs text-[#65858a]">Use pelo menos 8 caracteres ao criar sua conta.</p></div>
    {error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-3 py-2 text-sm font-medium text-[#a13d2d]">{error}</p>}
    <Button type="submit" disabled={pending} className="h-11 w-full rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{mode === "login" ? "Entrar" : "Criar conta"}</Button>
  </form><div className="border-t border-[#0b6976]/10 px-7 py-5 text-center text-sm text-[#58767b]">{mode === "login" ? <>Ainda não tem conta? <button type="button" onClick={() => setMode("register")} className="font-extrabold text-[#0b7e8a]">Criar agora</button></> : <>Já tem conta? <button type="button" onClick={() => setMode("login")} className="font-extrabold text-[#0b7e8a]">Entrar</button></>}<Link href="/" className="mt-3 block font-bold text-[#65858a] hover:text-[#073c45]">Voltar para explorar</Link></div></section></main>;
}

export { localLoginPath };
