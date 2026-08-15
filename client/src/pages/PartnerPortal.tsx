import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardMenuItem } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, Building2, Copy, ImagePlus, Loader2, Pencil, Plus, Sparkles, Store, Upload } from "lucide-react";
import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const partnerNavigation: DashboardMenuItem[] = [{ icon: Building2, label: "Meu negócio", path: "/parceiro" }];

type PartnerForm = {
  id?: number;
  categoryId: string;
  name: string;
  description: string;
  whatsapp: string;
  streetAddress: string;
  neighborhood: string;
  city: string;
  latitude: string;
  longitude: string;
  isDeliveryOnly: boolean;
  logoUrl: string;
  images: string[];
};

const blankForm: PartnerForm = { categoryId: "", name: "", description: "", whatsapp: "", streetAddress: "", neighborhood: "", city: "Salinópolis", latitude: "", longitude: "", isDeliveryOnly: false, logoUrl: "", images: [] };

function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-inherit"><span>{label}</span>{children}</label>;
}

export type HighlightAvailabilityDay = { date: string; endsAt: string; availableSlots: number; isAvailable: boolean };

export function getSelectableHighlightDay(days: HighlightAvailabilityDay[], selectedDate: string) {
  return days.find(day => day.date === selectedDate && day.isAvailable);
}

export function getHighlightStartAt(days: HighlightAvailabilityDay[], selectedDate: string) {
  const day = getSelectableHighlightDay(days, selectedDate);
  return day ? new Date(`${day.date}T12:00:00`) : null;
}

export function buildHighlightPixRequest(input: { establishmentId: string; planId: string; days: HighlightAvailabilityDay[]; selectedDate: string; ownerNote: string }) {
  const startsAt = getHighlightStartAt(input.days, input.selectedDate);
  if (!input.establishmentId || !input.planId || !startsAt) return null;
  return { establishmentId: Number(input.establishmentId), planId: Number(input.planId), startsAt, ownerNote: input.ownerNote || null };
}

export function HighlightAvailabilityCalendar({ days, selectedDate, onSelect }: { days: HighlightAvailabilityDay[]; selectedDate: string; onSelect: (date: string) => void }) {
  if (!days.length) return <p className="rounded-xl bg-white/10 p-3 text-sm text-[#c4dedc]">Sem datas para consultar neste período.</p>;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Disponibilidade de Destaques nos próximos dias">{days.map(day => {
    const isSelected = day.date === selectedDate;
    const dateLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" });
    return <button key={day.date} type="button" disabled={!day.isAvailable} onClick={() => onSelect(day.date)} aria-pressed={isSelected} className={`rounded-xl border p-2.5 text-left text-xs transition ${day.isAvailable ? isSelected ? "border-[#f4cf7c] bg-[#f4cf7c] text-[#073c45]" : "border-[#8cb9b9] bg-white/10 text-white hover:bg-white/20" : "cursor-not-allowed border-white/10 bg-black/10 text-white/45 line-through"}`}><span className="block font-extrabold capitalize">{dateLabel}</span><span className="mt-1 block font-medium">{day.isAvailable ? `${day.availableSlots} ${day.availableSlots === 1 ? "vaga" : "vagas"}` : "Indisponível"}</span></button>;
  })}</div>;
}

export function PartnerContent() {
  const { user, refresh: refreshAuth } = useAuth();
  const utils = trpc.useUtils();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const { data, isLoading } = trpc.owner.overview.useQuery(undefined, { enabled: Boolean(user && isOwner) });
  const { data: categories = [] } = trpc.directory.categories.useQuery();
  const [form, setForm] = useState<PartnerForm>(blankForm);
  const [editing, setEditing] = useState(false);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState("");
  const [highlightPlanId, setHighlightPlanId] = useState("");
  const [highlightStartAt, setHighlightStartAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [initialPayment, setInitialPayment] = useState<{ paymentRequestId: number | null; amountCents: number } | null>(null);
  const highlightAvailabilityInput = useMemo(() => ({ planId: Number(highlightPlanId || 0), days: 14 }), [highlightPlanId]);
  const { data: highlightAvailability, isFetching: isLoadingHighlightAvailability } = trpc.owner.highlightAvailability.useQuery(highlightAvailabilityInput, { enabled: Boolean(highlightPlanId) });
  const refresh = () => utils.owner.overview.invalidate();
  const upload = trpc.owner.uploadImage.useMutation();
  const enroll = trpc.owner.enroll.useMutation({ onSuccess: async () => { await Promise.all([refreshAuth(), utils.auth.me.invalidate()]); toast.success("Seu perfil de parceiro foi ativado."); } });
  const completeRegistration = trpc.owner.completeRegistration.useMutation({ onSuccess: payment => { refresh(); setInitialPayment(payment); setEditing(false); setForm(blankForm); toast.success("Cadastro concluído. Use o PIX gerado e envie o comprovante."); } });
  const update = trpc.owner.updateEstablishment.useMutation({ onSuccess: () => { refresh(); setEditing(false); toast.success("Informações atualizadas."); } });
  const requestHighlight = trpc.owner.requestHighlight.useMutation({ onSuccess: () => { refresh(); setHighlightPlanId(""); setNote(""); toast.success("PIX do Destaque criado. Envie o comprovante após pagar."); } });
  const submitProof = trpc.owner.submitPixProof.useMutation({ onSuccess: () => { refresh(); toast.success("Comprovante enviado para análise do administrador."); } });
  const highlightPlans = useMemo(() => data?.plans.filter(plan => plan.code !== "basico") ?? [], [data?.plans]);
  const establishmentById = useMemo(() => new Map(data?.establishments.map(item => [item.id, item]) ?? []), [data?.establishments]);
  const highlightDays = highlightAvailability?.days ?? [];
  const availableHighlightDays = useMemo(() => highlightDays.filter(day => day.isAvailable), [highlightDays]);
  const selectedHighlightDay = getSelectableHighlightDay(highlightDays, highlightStartAt) ?? availableHighlightDays[0];
  const set = <K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) => setForm(current => ({ ...current, [key]: value }));
  useEffect(() => {
    if (selectedHighlightDay && selectedHighlightDay.date !== highlightStartAt) setHighlightStartAt(selectedHighlightDay.date);
  }, [highlightStartAt, selectedHighlightDay]);
  const uploadFile = async (file: File) => {
    if (!user || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Use JPEG, PNG ou WebP de até 5 MB.");
    const base64 = await readFileAsBase64(file);
    return (await upload.mutateAsync({ fileName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 })).url;
  };

  const onLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { set("logoUrl", await uploadFile(file)); toast.success("Logomarca enviada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar logo."); } finally { event.target.value = ""; }
  };
  const onImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 6 - form.images.length);
    try { set("images", [...form.images, ...(await Promise.all(files.map(uploadFile)))].slice(0, 6)); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar imagens."); } finally { event.target.value = ""; }
  };
  const submitEstablishment = (event: FormEvent) => {
    event.preventDefault();
    if (!form.categoryId) return toast.error("Selecione uma categoria.");
    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;
    const payload = { categoryId: Number(form.categoryId), name: form.name, description: form.description, whatsapp: form.whatsapp, streetAddress: form.streetAddress || null, neighborhood: form.neighborhood || null, city: form.city || "Salinópolis", latitude, longitude, isDeliveryOnly: form.isDeliveryOnly, logoUrl: form.logoUrl || null, images: form.images.map(imageUrl => ({ imageUrl })) };
    if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) return toast.error("Use números válidos caso queira informar as coordenadas.");
    if (form.id) update.mutate({ id: form.id, ...payload }); else completeRegistration.mutate(payload);
  };
  const openEdit = (item: NonNullable<typeof data>["establishments"][number]) => {
    setForm({ id: item.id, categoryId: String(item.categoryId), name: item.name, description: item.description, whatsapp: item.whatsapp, streetAddress: item.streetAddress ?? "", neighborhood: item.neighborhood ?? "", city: item.city, latitude: String(item.latitude), longitude: String(item.longitude), isDeliveryOnly: item.isDeliveryOnly, logoUrl: item.logoUrl ?? "", images: item.images });
    setEditing(true);
  };
  const selectHighlight = (establishmentId: number) => {
    setSelectedEstablishmentId(String(establishmentId));
    document.getElementById("destaque-extra")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const submitHighlight = (event: FormEvent) => {
    event.preventDefault();
    const request = buildHighlightPixRequest({ establishmentId: selectedEstablishmentId, planId: highlightPlanId, days: highlightDays, selectedDate: selectedHighlightDay?.date ?? "", ownerNote: note });
    if (!request) return toast.error(!selectedEstablishmentId || !highlightPlanId ? "Escolha o estabelecimento e o plano de Destaque." : "Escolha uma data disponível para gerar o PIX do Destaque.");
    requestHighlight.mutate(request);
  };
  const uploadProof = async (requestId: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { submitProof.mutate({ requestId, pixProofUrl: await uploadFile(file) }); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar comprovante."); } finally { event.target.value = ""; }
  };

  if (!isOwner) return <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center py-10 text-center"><section className="w-full rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-[#0b6976]/10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf7f5] text-[#0b7e8a]"><Store className="h-6 w-6" /></span><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Área do parceiro</p><h1 className="mt-2 font-display text-3xl text-[#063b43]">Quer cadastrar seu estabelecimento?</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#5b7d82]">Ative seu perfil de parceiro para cadastrar e administrar somente os seus locais, gerar o PIX mensal no cadastro e contratar Destaques extras.</p><Button onClick={() => enroll.mutate()} disabled={enroll.isPending} className="mt-6 rounded-full bg-[#073c45] px-5 text-white hover:bg-[#0a5964]">{enroll.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Ativar perfil de parceiro</Button></section></div>;
  if (isLoading || !data) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div>;
  const pixReady = Boolean(data.paymentSettings.pixKey);
  const pendingMonthlyRenewal = data.paymentRequests.find(request => request.purpose === "assinatura" && ["aguardando_pagamento", "em_analise"].includes(request.status));
  const renewalSubscription = pendingMonthlyRenewal ? data.monthlySubscriptions.find(subscription => subscription.establishmentId === pendingMonthlyRenewal.establishmentId) : null;

  return <div className="mx-auto max-w-6xl pb-12">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Área do parceiro</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.045em] text-[#063b43]">Meu estabelecimento</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#5b7d82]">O PIX da mensalidade é criado automaticamente ao concluir o cadastro. Destaques são extras opcionais.</p></div><Button onClick={() => { setInitialPayment(null); setForm(blankForm); setEditing(true); }} className="rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]"><Plus className="h-4 w-4" /> Novo estabelecimento</Button></div>
    {pendingMonthlyRenewal && <section className="mt-6 rounded-[1.75rem] bg-[#f4cf7c] p-5 text-[#073c45] shadow-sm sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#76521e]">Renovação automática</p><h2 className="mt-1 font-display text-2xl">Sua mensalidade está pronta para pagamento</h2><p className="mt-2 text-sm leading-6">Valor: <strong>{money(pendingMonthlyRenewal.amountCents)}</strong>{renewalSubscription ? <> · vencimento em <strong>{new Date(renewalSubscription.dueAt).toLocaleDateString("pt-BR")}</strong></> : null}. Status: <strong>{pendingMonthlyRenewal.status.replaceAll("_", " ")}</strong>.</p>{pendingMonthlyRenewal.status === "aguardando_pagamento" ? <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#073c45] px-4 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4" />Enviar comprovante<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => uploadProof(pendingMonthlyRenewal.id, event)} /></label> : <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-bold"><Loader2 className="h-4 w-4" />Comprovante em análise</p>}</section>}
    {initialPayment && <section className="mt-6 rounded-[1.75rem] bg-[#073c45] p-5 text-white shadow-[0_18px_42px_rgba(7,60,69,0.18)] sm:p-7"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f4cf7c]">Cadastro concluído</p><h2 className="mt-1 font-display text-3xl">Pagamento PIX gerado</h2><p className="mt-2 text-sm leading-6 text-[#c4dedc]">A mensalidade inicial custa <strong className="text-white">{money(initialPayment.amountCents)}</strong>. Envie o comprovante para o administrador ativar seu estabelecimento.</p>{pixReady ? <PixData settings={data.paymentSettings} /> : <p className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#c4dedc]">O pedido foi gerado, mas o administrador ainda precisa informar a chave PIX.</p>}</section>}
    {editing && <section className="mt-7 rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/10 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Cadastro completo</p><h2 className="mt-1 font-display text-2xl text-[#063b43]">{form.id ? "Editar estabelecimento" : "Cadastrar estabelecimento"}</h2><p className="mt-1 text-sm text-[#638187]">Preencha descrição, contato, endereço, localização, logomarca e fotos. Ao finalizar, o PIX mensal é criado automaticamente.</p></div><Button variant="ghost" onClick={() => setEditing(false)} className="rounded-full">Cancelar</Button></div><form onSubmit={submitEstablishment} className="mt-6 grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome"><Input value={form.name} onChange={event => set("name", event.target.value)} required /></Field><Field label="Categoria"><select value={form.categoryId} onChange={event => set("categoryId", event.target.value)} className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" required><option value="">Selecione</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div><Field label="Descrição"><Textarea value={form.description} onChange={event => set("description", event.target.value)} minLength={12} required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="WhatsApp"><Input value={form.whatsapp} onChange={event => set("whatsapp", event.target.value)} required /></Field><Field label="Cidade"><Input value={form.city} onChange={event => set("city", event.target.value)} required /></Field><Field label="Endereço"><Input value={form.streetAddress} onChange={event => set("streetAddress", event.target.value)} required={!form.isDeliveryOnly} /></Field><Field label="Bairro"><Input value={form.neighborhood} onChange={event => set("neighborhood", event.target.value)} required={!form.isDeliveryOnly} /></Field><Field label="Latitude (opcional)"><Input type="number" step="any" value={form.latitude} onChange={event => set("latitude", event.target.value)} /></Field><Field label="Longitude (opcional)"><Input type="number" step="any" value={form.longitude} onChange={event => set("longitude", event.target.value)} /></Field></div><label className="flex items-center gap-2 text-sm font-semibold text-[#38656c]"><input type="checkbox" checked={form.isDeliveryOnly} onChange={event => set("isDeliveryOnly", event.target.checked)} className="h-4 w-4 accent-[#0b7e8a]" />Atendo somente por entrega</label><div className="grid gap-4 rounded-2xl bg-[#edf7f5] p-4 sm:grid-cols-2"><div><Label>Logomarca</Label><div className="mt-2 flex items-center gap-3">{form.logoUrl && <img src={form.logoUrl} alt="Logo enviada" className="h-12 w-12 rounded-xl bg-white p-1 object-contain shadow-sm" />}<label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0b7e8a] px-3 py-2 text-xs font-bold text-white"><ImagePlus className="h-3.5 w-3.5" />{form.logoUrl ? "Trocar logo" : "Enviar logo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onLogo} /></label></div></div><div><Label>Galeria ({form.images.length}/6)</Label><div className="mt-2 flex flex-wrap gap-2">{form.images.map(url => <img key={url} src={url} alt="Imagem enviada" className="h-12 w-12 rounded-xl object-cover" />)}<label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#0b7e8a]/25 bg-white px-3 py-2 text-xs font-bold text-[#0b7e8a]"><ImagePlus className="h-3.5 w-3.5" />Fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onImages} /></label></div></div></div><Button type="submit" disabled={completeRegistration.isPending || update.isPending || upload.isPending} className="justify-self-end rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]">{(completeRegistration.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? "Salvar alterações" : "Finalizar cadastro e gerar PIX"}</Button></form></section>}
    <section className="mt-7"><h2 className="font-display text-2xl text-[#063b43]">Seus estabelecimentos</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{data.establishments.map(item => <article key={item.id} className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl text-[#063b43]">{item.name}</h3><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold ${item.isActive ? "bg-[#ddf5e8] text-[#17734d]" : "bg-[#fff3d8] text-[#8a651f]"}`}>{item.isActive ? "no ar" : "aguarda assinatura"}</span></div><p className="mt-1 text-sm text-[#638187]">{item.categoryName} · {item.neighborhood || item.city}</p></div><Button variant="outline" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`} className="rounded-full"><Pencil className="h-4 w-4" /></Button></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-[#5b7d82]">{item.description}</p><Button variant="outline" onClick={() => selectHighlight(item.id)} className="mt-4 rounded-full border-[#d99023]/30 text-[#9a6213] hover:bg-[#fff4dd]"><Sparkles className="h-4 w-4" /> Contratar Destaque</Button></article>)}{!data.establishments.length && <div className="rounded-[1.5rem] border border-dashed border-[#9bc9c4] bg-[#edf8f6] p-8 text-center md:col-span-2"><Store className="mx-auto h-6 w-6 text-[#0b7e8a]" /><p className="mt-3 font-display text-xl text-[#063b43]">Cadastre seu primeiro estabelecimento.</p></div>}</div></section>
    <section id="destaque-extra" className="mt-8 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><form onSubmit={submitHighlight} className="rounded-[1.75rem] bg-[#073c45] p-5 text-white sm:p-7"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f4cf7c]">Compra extra</p><h2 className="mt-1 font-display text-3xl">Destacar meu estabelecimento</h2><p className="mt-2 text-sm leading-6 text-[#c4dedc]">Escolha um estabelecimento seu e um período de Destaque. O PIX extra será criado para confirmação do administrador.</p><div className="mt-5 grid gap-3"><Field label="Estabelecimento"><select value={selectedEstablishmentId} onChange={event => setSelectedEstablishmentId(event.target.value)} className="h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 text-sm text-white"><option value="" className="text-[#063b43]">Selecione</option>{data.establishments.map(item => <option key={item.id} value={item.id} className="text-[#063b43]">{item.name}</option>)}</select></Field><Field label="Plano de Destaque"><select value={highlightPlanId} onChange={event => setHighlightPlanId(event.target.value)} className="h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 text-sm text-white"><option value="" className="text-[#063b43]">Selecione</option>{highlightPlans.map(plan => <option key={plan.id} value={plan.id} className="text-[#063b43]">{plan.label} · {money(plan.priceCents)}</option>)}</select></Field>{highlightPlanId && <div className="grid gap-2"><p className="text-sm font-semibold">Datas de início</p>{isLoadingHighlightAvailability ? <p className="rounded-md bg-white/10 px-3 py-2 text-sm text-[#c4dedc]">Consultando vagas disponíveis…</p> : <HighlightAvailabilityCalendar days={highlightDays} selectedDate={selectedHighlightDay?.date ?? ""} onSelect={setHighlightStartAt} />}</div>}<p className="text-xs leading-5 text-[#c4dedc]">Cada data mostra as vagas restantes para todo o período do plano. Datas sem vaga ficam indisponíveis para seleção.</p><Field label="Observação para o administrador"><Textarea value={note} onChange={event => setNote(event.target.value)} className="border-white/25 bg-white/10 text-white" /></Field><Button type="submit" disabled={requestHighlight.isPending || !selectedHighlightDay} className="rounded-full bg-[#f4cf7c] text-[#073c45] hover:bg-[#ffe3a0]"><Sparkles className="h-4 w-4" />Gerar PIX do Destaque</Button></div>{pixReady ? <PixData settings={data.paymentSettings} /> : <p className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#c4dedc]">Os dados PIX serão disponibilizados pelo administrador antes do pagamento.</p>}</form><div className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8 sm:p-7"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Acompanhamento</p><h2 className="mt-1 font-display text-3xl text-[#063b43]">Seus pagamentos</h2><div className="mt-5 grid gap-3">{data.paymentRequests.map(request => <article key={request.id} className="rounded-2xl border border-[#e0efec] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-[#164e57]">{establishmentById.get(request.establishmentId)?.name ?? "Estabelecimento"}</p><p className="mt-1 text-xs text-[#648187]">{request.purpose === "assinatura" ? "Mensalidade" : "Destaque"} · {money(request.amountCents)}</p></div><span className="rounded-full bg-[#edf7f5] px-2.5 py-1 text-[0.65rem] font-extrabold text-[#0b7e8a]">{request.status.replaceAll("_", " ")}</span></div>{request.status === "aguardando_pagamento" && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#073c45] px-3 py-2 text-xs font-bold text-white"><Upload className="h-3.5 w-3.5" />Enviar comprovante<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => uploadProof(request.id, event)} /></label>}{request.status === "em_analise" && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#a36e1b]"><Loader2 className="h-3.5 w-3.5" />Aguardando confirmação do administrador.</p>}{request.status === "confirmado" && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#19764f]"><BadgeCheck className="h-3.5 w-3.5" />Pagamento confirmado.</p>}{request.adminNote && <p className="mt-3 text-xs leading-5 text-[#5b7d82]">Observação do administrador: {request.adminNote}</p>}</article>)}{!data.paymentRequests.length && <p className="rounded-2xl bg-[#f2f9f7] p-5 text-sm leading-6 text-[#638187]">A mensalidade inicial e os pedidos de Destaque aparecerão aqui.</p>}</div></div></section>
  </div>;
}

function PixData({ settings }: { settings: { pixKey: string | null; recipientName: string | null; instructions: string | null } }) {
  return <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#f4cf7c]">Dados para pagamento</p><p className="mt-2 text-sm font-bold">{settings.recipientName || "Recebedor PIX"}</p><p className="mt-1 break-all text-sm text-white/85">{settings.pixKey}</p><button type="button" onClick={() => navigator.clipboard.writeText(settings.pixKey ?? "").then(() => toast.success("Chave PIX copiada."))} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f4cf7c]"><Copy className="h-3.5 w-3.5" />Copiar chave PIX</button>{settings.instructions && <p className="mt-3 text-xs leading-5 text-white/75">{settings.instructions}</p>}</div>;
}

export function MonthlyRenewalCard({ amountCents, dueAt, status, onProof }: { amountCents: number; dueAt: Date; status: "aguardando_pagamento" | "em_analise"; onProof: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <section className="mt-6 rounded-[1.75rem] bg-[#f4cf7c] p-5 text-[#073c45] shadow-sm sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#76521e]">Renovação automática</p><h2 className="mt-1 font-display text-2xl">Sua mensalidade está pronta para pagamento</h2><p className="mt-2 text-sm leading-6">Valor: <strong>{money(amountCents)}</strong> · vencimento em <strong>{dueAt.toLocaleDateString("pt-BR")}</strong>. Status: <strong>{status.replaceAll("_", " ")}</strong>.</p>{status === "aguardando_pagamento" ? <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#073c45] px-4 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4" />Enviar comprovante<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onProof} /></label> : <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-bold"><Loader2 className="h-4 w-4" />Comprovante em análise</p>}</section>;
}

export default function PartnerPortal() { return <DashboardLayout navigation={partnerNavigation}><PartnerContent /></DashboardLayout>; }
