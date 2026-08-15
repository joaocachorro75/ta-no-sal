import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout, { type DashboardMenuItem } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, Building2, CircleDollarSign, Copy, ImagePlus, Loader2, Pencil, Plus, Sparkles, Store, Upload, WalletCards } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const partnerNavigation: DashboardMenuItem[] = [
  { icon: Building2, label: "Meu negócio", path: "/parceiro" },
];

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

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }

function PartnerContent() {
  const { user, refresh: refreshAuth } = useAuth();
  const utils = trpc.useUtils();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const { data, isLoading } = trpc.owner.overview.useQuery(undefined, { enabled: Boolean(user && isOwner) });
  const { data: categories = [] } = trpc.directory.categories.useQuery();
  const [form, setForm] = useState<PartnerForm>(blankForm);
  const [editing, setEditing] = useState(false);
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState("");
  const [purpose, setPurpose] = useState<"assinatura" | "destaque">("assinatura");
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => utils.owner.overview.invalidate();
  const upload = trpc.owner.uploadImage.useMutation();
  const enroll = trpc.owner.enroll.useMutation({ onSuccess: async () => { await Promise.all([refreshAuth(), utils.auth.me.invalidate()]); toast.success("Seu perfil de parceiro foi ativado."); } });
  const create = trpc.owner.createEstablishment.useMutation({ onSuccess: () => { refresh(); setEditing(false); setForm(blankForm); toast.success("Cadastro enviado. Aguarde a confirmação da assinatura para entrar no ar."); } });
  const update = trpc.owner.updateEstablishment.useMutation({ onSuccess: () => { refresh(); setEditing(false); toast.success("Informações atualizadas."); } });
  const requestPayment = trpc.owner.requestPayment.useMutation({ onSuccess: () => { refresh(); setNote(""); toast.success("Solicitação PIX criada. Envie o comprovante após pagar."); } });
  const submitProof = trpc.owner.submitPixProof.useMutation({ onSuccess: () => { refresh(); toast.success("Comprovante enviado para análise do administrador."); } });

  const planOptions = useMemo(() => data?.plans.filter(plan => purpose === "assinatura" ? plan.code === "basico" : plan.code !== "basico") ?? [], [data?.plans, purpose]);
  const establishmentById = useMemo(() => new Map(data?.establishments.map(item => [item.id, item]) ?? []), [data?.establishments]);
  const set = <K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) => setForm(current => ({ ...current, [key]: value }));

  const uploadFile = async (file: File) => {
    if (!user || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Use JPEG, PNG ou WebP de até 5 MB.");
    const base64 = await readFileAsBase64(file);
    const result = await upload.mutateAsync({ fileName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 });
    return result.url;
  };

  const onLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { set("logoUrl", await uploadFile(file)); toast.success("Logomarca enviada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar logo."); } finally { event.target.value = ""; }
  };
  const onImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 6 - form.images.length);
    try { const urls = await Promise.all(files.map(uploadFile)); set("images", [...form.images, ...urls].slice(0, 6)); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar imagens."); } finally { event.target.value = ""; }
  };
  const submitEstablishment = (event: FormEvent) => {
    event.preventDefault();
    if (!form.categoryId) return toast.error("Selecione uma categoria.");
    const payload = { categoryId: Number(form.categoryId), name: form.name, description: form.description, whatsapp: form.whatsapp, streetAddress: form.streetAddress || null, neighborhood: form.neighborhood || null, city: form.city || "Salinópolis", latitude: Number(form.latitude), longitude: Number(form.longitude), isDeliveryOnly: form.isDeliveryOnly, logoUrl: form.logoUrl || null, images: form.images.map(imageUrl => ({ imageUrl })) };
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) return toast.error("Informe latitude e longitude válidas.");
    if (form.id) update.mutate({ id: form.id, ...payload }); else create.mutate(payload);
  };
  const openEdit = (item: NonNullable<typeof data>["establishments"][number]) => { setForm({ id: item.id, categoryId: String(item.categoryId), name: item.name, description: item.description, whatsapp: item.whatsapp, streetAddress: item.streetAddress ?? "", neighborhood: item.neighborhood ?? "", city: item.city, latitude: String(item.latitude), longitude: String(item.longitude), isDeliveryOnly: item.isDeliveryOnly, logoUrl: item.logoUrl ?? "", images: item.images }); setEditing(true); };
  const submitRequest = (event: FormEvent) => { event.preventDefault(); if (!selectedEstablishmentId || !planId) return toast.error("Escolha o estabelecimento e o plano."); requestPayment.mutate({ establishmentId: Number(selectedEstablishmentId), planId: Number(planId), purpose, ownerNote: note || null }); };
  const uploadProof = async (requestId: number, event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const pixProofUrl = await uploadFile(file); submitProof.mutate({ requestId, pixProofUrl }); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar comprovante."); } finally { event.target.value = ""; } };

  if (!isOwner) return <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center py-10 text-center"><section className="w-full rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-[#0b6976]/10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf7f5] text-[#0b7e8a]"><Store className="h-6 w-6" /></span><p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Área do parceiro</p><h1 className="mt-2 font-display text-3xl text-[#063b43]">Quer cadastrar seu estabelecimento?</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#5b7d82]">Ative seu perfil de parceiro para cadastrar e administrar somente os seus locais, solicitar assinatura ou destaque por PIX e acompanhar a confirmação.</p><Button onClick={() => enroll.mutate()} disabled={enroll.isPending} className="mt-6 rounded-full bg-[#073c45] px-5 text-white hover:bg-[#0a5964]">{enroll.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Ativar perfil de parceiro</Button></section></div>;
  if (isLoading || !data) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div>;
  const pixReady = Boolean(data.paymentSettings.pixKey);

  return <div className="mx-auto max-w-6xl pb-12"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Área do parceiro</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.045em] text-[#063b43]">Meu estabelecimento</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#5b7d82]">Cadastre, mantenha seus dados atualizados e solicite assinatura ou destaque.</p></div><Button onClick={() => { setForm(blankForm); setEditing(true); }} className="rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]"><Plus className="h-4 w-4" /> Novo estabelecimento</Button></div>
    {editing && <section className="mt-7 rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/10 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Cadastro do parceiro</p><h2 className="mt-1 font-display text-2xl text-[#063b43]">{form.id ? "Editar estabelecimento" : "Cadastrar estabelecimento"}</h2><p className="mt-1 text-sm text-[#638187]">Novos cadastros ficam aguardando confirmação da assinatura para aparecer na vitrine.</p></div><Button variant="ghost" onClick={() => setEditing(false)} className="rounded-full">Cancelar</Button></div><form onSubmit={submitEstablishment} className="mt-6 grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome"><Input value={form.name} onChange={event => set("name", event.target.value)} required /></Field><Field label="Categoria"><select value={form.categoryId} onChange={event => set("categoryId", event.target.value)} className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" required><option value="">Selecione</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div><Field label="Descrição"><Textarea value={form.description} onChange={event => set("description", event.target.value)} minLength={12} required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="WhatsApp"><Input value={form.whatsapp} onChange={event => set("whatsapp", event.target.value)} required /></Field><Field label="Cidade"><Input value={form.city} onChange={event => set("city", event.target.value)} required /></Field><Field label="Endereço"><Input value={form.streetAddress} onChange={event => set("streetAddress", event.target.value)} /></Field><Field label="Bairro"><Input value={form.neighborhood} onChange={event => set("neighborhood", event.target.value)} /></Field><Field label="Latitude"><Input type="number" step="any" value={form.latitude} onChange={event => set("latitude", event.target.value)} required /></Field><Field label="Longitude"><Input type="number" step="any" value={form.longitude} onChange={event => set("longitude", event.target.value)} required /></Field></div><label className="flex items-center gap-2 text-sm font-semibold text-[#38656c]"><input type="checkbox" checked={form.isDeliveryOnly} onChange={event => set("isDeliveryOnly", event.target.checked)} className="h-4 w-4 accent-[#0b7e8a]" />Atendo somente por entrega</label><div className="grid gap-4 rounded-2xl bg-[#edf7f5] p-4 sm:grid-cols-2"><div><Label>Logomarca</Label><div className="mt-2 flex items-center gap-3">{form.logoUrl && <img src={form.logoUrl} alt="Logo enviada" className="h-12 w-12 rounded-xl bg-white p-1 object-contain shadow-sm" />}<label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0b7e8a] px-3 py-2 text-xs font-bold text-white"><ImagePlus className="h-3.5 w-3.5" />{form.logoUrl ? "Trocar logo" : "Enviar logo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onLogo} /></label></div></div><div><Label>Galeria ({form.images.length}/6)</Label><div className="mt-2 flex flex-wrap gap-2">{form.images.map(url => <img key={url} src={url} alt="Imagem enviada" className="h-12 w-12 rounded-xl object-cover" />)}<label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#0b7e8a]/25 bg-white px-3 py-2 text-xs font-bold text-[#0b7e8a]"><ImagePlus className="h-3.5 w-3.5" />Fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onImages} /></label></div></div></div><Button type="submit" disabled={create.isPending || update.isPending || upload.isPending} className="justify-self-end rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]">{(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? "Salvar alterações" : "Enviar cadastro"}</Button></form></section>}
    <section className="mt-7"><h2 className="font-display text-2xl text-[#063b43]">Seus estabelecimentos</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{data.establishments.map(item => <article key={item.id} className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl text-[#063b43]">{item.name}</h3><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold ${item.isActive ? "bg-[#ddf5e8] text-[#17734d]" : "bg-[#fff3d8] text-[#8a651f]"}`}>{item.isActive ? "no ar" : "aguarda assinatura"}</span></div><p className="mt-1 text-sm text-[#638187]">{item.categoryName} · {item.neighborhood || item.city}</p></div><Button variant="outline" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`} className="rounded-full"><Pencil className="h-4 w-4" /></Button></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-[#5b7d82]">{item.description}</p></article>)}{!data.establishments.length && <div className="rounded-[1.5rem] border border-dashed border-[#9bc9c4] bg-[#edf8f6] p-8 text-center md:col-span-2"><Store className="mx-auto h-6 w-6 text-[#0b7e8a]" /><p className="mt-3 font-display text-xl text-[#063b43]">Cadastre seu primeiro estabelecimento.</p></div>}</div></section>
    <section className="mt-8 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><form onSubmit={submitRequest} className="rounded-[1.75rem] bg-[#073c45] p-5 text-white sm:p-7"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f4cf7c]">Assinatura e destaque</p><h2 className="mt-1 font-display text-3xl">Solicitar pagamento PIX</h2><p className="mt-2 text-sm leading-6 text-[#c4dedc]">O administrador libera a assinatura ou o destaque após conferir o comprovante.</p><div className="mt-5 grid gap-3"><Field label="Estabelecimento"><select value={selectedEstablishmentId} onChange={event => setSelectedEstablishmentId(event.target.value)} className="h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 text-sm text-white"><option value="" className="text-[#063b43]">Selecione</option>{data.establishments.map(item => <option key={item.id} value={item.id} className="text-[#063b43]">{item.name}</option>)}</select></Field><Field label="O que deseja"><select value={purpose} onChange={event => { setPurpose(event.target.value as "assinatura" | "destaque"); setPlanId(""); }} className="h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 text-sm text-white"><option value="assinatura" className="text-[#063b43]">Assinatura mensal</option><option value="destaque" className="text-[#063b43]">Destaque</option></select></Field><Field label="Plano"><select value={planId} onChange={event => setPlanId(event.target.value)} className="h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 text-sm text-white"><option value="" className="text-[#063b43]">Selecione</option>{planOptions.map(plan => <option key={plan.id} value={plan.id} className="text-[#063b43]">{plan.label} · {money(plan.priceCents)}</option>)}</select></Field><Field label="Observação para o administrador"><Textarea value={note} onChange={event => setNote(event.target.value)} className="border-white/25 bg-white/10 text-white" /></Field><Button type="submit" disabled={requestPayment.isPending} className="rounded-full bg-[#f4cf7c] text-[#073c45] hover:bg-[#ffe3a0]"><CircleDollarSign className="h-4 w-4" />Solicitar PIX</Button></div>{pixReady ? <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#f4cf7c]">Dados para pagamento</p><p className="mt-2 text-sm font-bold">{data.paymentSettings.recipientName || "Recebedor PIX"}</p><p className="mt-1 break-all text-sm text-white/85">{data.paymentSettings.pixKey}</p><button type="button" onClick={() => navigator.clipboard.writeText(data.paymentSettings.pixKey ?? "").then(() => toast.success("Chave PIX copiada."))} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f4cf7c]"><Copy className="h-3.5 w-3.5" />Copiar chave</button>{data.paymentSettings.instructions && <p className="mt-3 text-xs leading-5 text-white/75">{data.paymentSettings.instructions}</p>}</div> : <p className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#c4dedc]">Os dados PIX serão disponibilizados pelo administrador antes do pagamento.</p>}</form><div className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8 sm:p-7"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Acompanhamento</p><h2 className="mt-1 font-display text-3xl text-[#063b43]">Seus pedidos</h2><div className="mt-5 grid gap-3">{data.paymentRequests.map(request => <article key={request.id} className="rounded-2xl border border-[#e0efec] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-[#164e57]">{establishmentById.get(request.establishmentId)?.name ?? "Estabelecimento"}</p><p className="mt-1 text-xs text-[#648187]">{request.purpose === "assinatura" ? "Assinatura" : "Destaque"} · {money(request.amountCents)}</p></div><span className="rounded-full bg-[#edf7f5] px-2.5 py-1 text-[0.65rem] font-extrabold text-[#0b7e8a]">{request.status.replaceAll("_", " ")}</span></div>{request.status === "aguardando_pagamento" && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#073c45] px-3 py-2 text-xs font-bold text-white"><Upload className="h-3.5 w-3.5" />Enviar comprovante<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => uploadProof(request.id, event)} /></label>}{request.status === "em_analise" && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#a36e1b]"><Loader2 className="h-3.5 w-3.5" />Aguardando confirmação do administrador.</p>}{request.status === "confirmado" && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#19764f]"><BadgeCheck className="h-3.5 w-3.5" />Pagamento confirmado.</p>}{request.adminNote && <p className="mt-3 text-xs leading-5 text-[#5b7d82]">Observação do administrador: {request.adminNote}</p>}</article>)}{!data.paymentRequests.length && <p className="rounded-2xl bg-[#f2f9f7] p-5 text-sm leading-6 text-[#638187]">Suas solicitações de assinatura e destaque aparecerão aqui.</p>}</div></div></section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-semibold text-inherit"><span>{label}</span>{children}</label>; }

export default function PartnerPortal() { return <DashboardLayout navigation={partnerNavigation}><PartnerContent /></DashboardLayout>; }
