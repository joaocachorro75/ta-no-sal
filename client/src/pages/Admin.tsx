import DashboardLayout from "@/components/DashboardLayout";
import AdminPropertiesPanel from "@/components/AdminPropertiesPanel";
import AdminMuralPanel from "@/components/AdminMuralPanel";
import { Brand, BeachPlaceholder } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, ChevronRight, CircleDollarSign, ImagePlus, Images, LayoutDashboard, Loader2, MapPin, Pencil, Plus, Sparkles, Store, Tag, Tags, Trash2, WalletCards, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type AdminTab = "inicio" | "estabelecimentos" | "categorias" | "planos" | "imoveis" | "mural" | "mensalidades" | "destaques" | "pix";

type EstablishmentForm = {
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
  isActive: boolean;
  logoUrl: string;
  images: string[];
};

const emptyEstablishment: EstablishmentForm = {
  categoryId: "",
  name: "",
  description: "",
  whatsapp: "",
  streetAddress: "",
  neighborhood: "",
  city: "Salinópolis",
  latitude: "",
  longitude: "",
  isDeliveryOnly: false,
  isActive: true,
  logoUrl: "",
  images: [],
};

const tabItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "inicio", label: "Visão geral", icon: LayoutDashboard },
  { id: "estabelecimentos", label: "Estabelecimentos", icon: Store },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "planos", label: "Planos", icon: Tag },
  { id: "imoveis", label: "Imóveis", icon: Building2 },
  { id: "mural", label: "Mural", icon: Images },
  { id: "mensalidades", label: "Mensalidades", icon: WalletCards },
  { id: "pix", label: "PIX", icon: CircleDollarSign },
  { id: "destaques", label: "Destaques", icon: Sparkles },
];

function toCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function toDateValue(value: Date | string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function StatusPill({ status }: { status: "pendente" | "pago" | "atrasado" | "cancelado" }) {
  const styles = {
    pendente: "bg-[#fff3d8] text-[#8a651f]",
    pago: "bg-[#ddf5e8] text-[#17734d]",
    atrasado: "bg-[#fbe0dd] text-[#a54235]",
    cancelado: "bg-[#e9eeee] text-[#52666a]",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold capitalize ${styles[status]}`}>{status}</span>;
}

function EstablishmentDialog({
  open,
  onOpenChange,
  initial,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EstablishmentForm;
  categories: { id: number; name: string; isActive: boolean }[];
}) {
  const [form, setForm] = useState<EstablishmentForm>(initial);
  const utils = trpc.useUtils();
  const uploadImage = trpc.admin.uploadImage.useMutation();
  const createEstablishment = trpc.admin.createEstablishment.useMutation({ onSuccess: async () => { await utils.admin.overview.invalidate(); toast.success("Estabelecimento cadastrado."); onOpenChange(false); } });
  const updateEstablishment = trpc.admin.updateEstablishment.useMutation({ onSuccess: async () => { await utils.admin.overview.invalidate(); toast.success("Estabelecimento atualizado."); onOpenChange(false); } });

  const update = <K extends keyof EstablishmentForm>(key: K, value: EstablishmentForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const allowed = files.filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024).slice(0, 6 - form.images.length);
    if (allowed.length !== files.length) toast.error("Use JPEG, PNG ou WebP de até 5 MB; a galeria aceita no máximo 6 fotos.");
    try {
      const urls = await Promise.all(allowed.map(async file => {
        const base64 = await readFileAsBase64(file);
        const uploaded = await uploadImage.mutateAsync({ fileName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 });
        return uploaded.url;
      }));
      update("images", [...form.images, ...urls].slice(0, 6));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar a imagem.");
    } finally {
      event.target.value = "";
    }
  };

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Use JPEG, PNG ou WebP de até 5 MB para a logomarca.");
      event.target.value = "";
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      const uploaded = await uploadImage.mutateAsync({ fileName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 });
      update("logoUrl", uploaded.url);
      toast.success("Logomarca enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar a logomarca.");
    } finally {
      event.target.value = "";
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.categoryId) return toast.error("Selecione uma categoria.");
    const payload = {
      categoryId: Number(form.categoryId), name: form.name, description: form.description, whatsapp: form.whatsapp,
      streetAddress: form.streetAddress || null, neighborhood: form.neighborhood || null, city: form.city || "Salinópolis",
      latitude: form.latitude.trim() ? Number(form.latitude) : null, longitude: form.longitude.trim() ? Number(form.longitude) : null, isDeliveryOnly: form.isDeliveryOnly, isActive: form.isActive,
      logoUrl: form.logoUrl || null,
      images: form.images.map(imageUrl => ({ imageUrl })),
    };
    if ((payload.latitude !== null && !Number.isFinite(payload.latitude)) || (payload.longitude !== null && !Number.isFinite(payload.longitude))) return toast.error("Use números válidos caso queira informar as coordenadas.");
    if (form.id) updateEstablishment.mutate({ id: form.id, ...payload }); else createEstablishment.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) setForm(initial); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-[#063b43]">{form.id ? "Editar estabelecimento" : "Novo estabelecimento"}</DialogTitle>
          <DialogDescription>Cadastre as informações que serão exibidas para visitantes do Tô no Sal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-3 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={form.name} onChange={event => update("name", event.target.value)} required placeholder="Ex.: Casa do Açaí" /></Field>
            <Field label="Categoria"><select value={form.categoryId} onChange={event => update("categoryId", event.target.value)} required className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Selecione</option>{categories.filter(category => category.isActive || String(category.id) === form.categoryId).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
          </div>
          <Field label="Descrição"><Textarea value={form.description} onChange={event => update("description", event.target.value)} required minLength={12} placeholder="Conte o que o visitante encontra neste local." /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={event => update("whatsapp", event.target.value)} required placeholder="5591..." /></Field>
            <Field label="Cidade"><Input value={form.city} onChange={event => update("city", event.target.value)} required /></Field>
            <Field label="Endereço"><Input value={form.streetAddress} onChange={event => update("streetAddress", event.target.value)} placeholder="Rua, número" /></Field>
            <Field label="Bairro"><Input value={form.neighborhood} onChange={event => update("neighborhood", event.target.value)} placeholder="Atalaia, Maçarico..." /></Field>
            <Field label="Latitude (opcional)"><Input type="number" step="any" value={form.latitude} onChange={event => update("latitude", event.target.value)} placeholder="-0.61" /></Field>
            <Field label="Longitude (opcional)"><Input type="number" step="any" value={form.longitude} onChange={event => update("longitude", event.target.value)} placeholder="-47.35" /></Field>
          </div>
          <div className="grid gap-3 rounded-2xl bg-[#edf7f5] p-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-[#285961]"><input checked={form.isDeliveryOnly} onChange={event => update("isDeliveryOnly", event.target.checked)} type="checkbox" className="h-4 w-4 accent-[#0a7c87]" />Atende somente por entrega</label>
            <label className="flex items-center gap-3 text-sm font-semibold text-[#285961]"><input checked={form.isActive} onChange={event => update("isActive", event.target.checked)} type="checkbox" className="h-4 w-4 accent-[#0a7c87]" />Estabelecimento ativo</label>
          </div>
          <div className="rounded-2xl bg-[#f7f3ea] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label>Logomarca do estabelecimento</Label>
                <p className="mt-1 text-xs leading-5 text-[#638187]">A logo aparece sobre a foto principal do cartão. Este campo é opcional.</p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#0b7e8a] px-3 py-2 text-xs font-bold text-white"><ImagePlus className="h-3.5 w-3.5" />{uploadImage.isPending ? "Enviando..." : form.logoUrl ? "Trocar logo" : "Enviar logo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} className="hidden" disabled={uploadImage.isPending} /></label>
            </div>
            {form.logoUrl ? <div className="mt-3 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#0b6976]/10"><img src={form.logoUrl} alt="Prévia da logomarca" className="h-full w-full object-contain" /></div><Button type="button" variant="ghost" onClick={() => update("logoUrl", "")} className="h-8 rounded-full px-3 text-xs text-destructive">Remover logo</Button></div> : <p className="mt-3 text-xs text-[#638187]">Envie uma versão quadrada ou horizontal em PNG, JPEG ou WebP.</p>}
          </div>
          <div>
            <div className="flex items-center justify-between"><Label>Galeria de fotos <span className="font-normal text-muted-foreground">({form.images.length}/6)</span></Label><label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#073c45] px-3 py-2 text-xs font-bold text-white"><ImagePlus className="h-3.5 w-3.5" />{uploadImage.isPending ? "Enviando..." : "Adicionar fotos"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadFiles} className="hidden" disabled={uploadImage.isPending || form.images.length >= 6} /></label></div>
            {form.images.length ? <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">{form.images.map((url, index) => <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-[#dcefed]"><img src={url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label="Remover foto" onClick={() => update("images", form.images.filter(image => image !== url))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[#073c45]/85 text-white opacity-0 transition group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button></div>)}</div> : <p className="mt-2 text-sm text-[#638187]">Envie até seis imagens que mostrem o local, cardápio ou produtos.</p>}
          </div>
          <div className="flex justify-end gap-3 border-t pt-5"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancelar</Button><Button type="submit" disabled={createEstablishment.isPending || updateEstablishment.isPending} className="rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]">{(createEstablishment.isPending || updateEstablishment.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? "Salvar alterações" : "Criar estabelecimento"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }

function AdminContent() {
  const [tab, setTab] = useState<AdminTab>("inicio");
  const [establishmentDialog, setEstablishmentDialog] = useState(false);
  const [editing, setEditing] = useState<EstablishmentForm>(emptyEstablishment);
  const [categoryName, setCategoryName] = useState("");
  const [featureForm, setFeatureForm] = useState({ establishmentId: "", planId: "", startsAt: toDateValue(new Date()), endsAt: "", displayOrder: "0" });
  const [pixForm, setPixForm] = useState({ pixKey: "", recipientName: "", instructions: "", dailyHighlightCapacity: "5" });
  const utils = trpc.useUtils();
  const { data, isLoading, isError } = trpc.admin.overview.useQuery();
  const { data: paymentSettings } = trpc.admin.paymentSettings.useQuery();
  const { data: paymentRequests = [] } = trpc.admin.paymentRequests.useQuery();
  const refresh = () => utils.admin.overview.invalidate();
  const refreshPayments = () => Promise.all([utils.admin.paymentRequests.invalidate(), utils.admin.paymentSettings.invalidate(), refresh()]);
  const createCategory = trpc.admin.createCategory.useMutation({ onSuccess: () => { refresh(); setCategoryName(""); toast.success("Categoria criada."); } });
  const updateCategory = trpc.admin.updateCategory.useMutation({ onSuccess: refresh });
  const deleteCategory = trpc.admin.deleteCategory.useMutation({ onSuccess: () => { refresh(); toast.success("Categoria removida."); } });
  const deleteEstablishment = trpc.admin.deleteEstablishment.useMutation({ onSuccess: () => { refresh(); toast.success("Estabelecimento removido."); } });
  const updatePlan = trpc.admin.updatePlan.useMutation({ onSuccess: () => { refresh(); toast.success("Plano atualizado."); } });
  const createFeatured = trpc.admin.createFeaturedSlot.useMutation({ onSuccess: () => { refresh(); toast.success("Destaque agendado."); } });
  const updateFeatured = trpc.admin.updateFeaturedSlotStatus.useMutation({ onSuccess: refresh });
  const updatePaymentSettings = trpc.admin.updatePaymentSettings.useMutation({ onSuccess: () => { refreshPayments(); toast.success("Dados PIX atualizados."); } });
  const confirmPaymentRequest = trpc.admin.confirmPaymentRequest.useMutation({ onSuccess: () => { refreshPayments(); toast.success("Pagamento confirmado e benefício liberado."); } });
  const rejectPaymentRequest = trpc.admin.rejectPaymentRequest.useMutation({ onSuccess: () => { refreshPayments(); toast.success("Solicitação devolvida ao parceiro."); } });

  useEffect(() => {
    if (paymentSettings) setPixForm({ pixKey: paymentSettings.pixKey ?? "", recipientName: paymentSettings.recipientName ?? "", instructions: paymentSettings.instructions ?? "", dailyHighlightCapacity: String(paymentSettings.dailyHighlightCapacity ?? 5) });
  }, [paymentSettings]);
  const planById = useMemo(() => new Map(data?.plans.map(plan => [plan.id, plan]) ?? []), [data?.plans]);
  const establishmentById = useMemo(() => new Map(data?.establishments.map(establishment => [establishment.id, establishment]) ?? []), [data?.establishments]);
  const paidCount = data?.subscriptions.filter(subscription => subscription.status === "pago").length ?? 0;
  const openCreate = () => { setEditing(emptyEstablishment); setEstablishmentDialog(true); };
  const openEdit = (establishment: NonNullable<typeof data>["establishments"][number]) => { setEditing({ id: establishment.id, categoryId: String(establishment.categoryId), name: establishment.name, description: establishment.description, whatsapp: establishment.whatsapp, streetAddress: establishment.streetAddress ?? "", neighborhood: establishment.neighborhood ?? "", city: establishment.city, latitude: String(establishment.latitude), longitude: String(establishment.longitude), isDeliveryOnly: establishment.isDeliveryOnly, isActive: establishment.isActive, logoUrl: establishment.logoUrl ?? "", images: establishment.images }); setEstablishmentDialog(true); };

  if (isLoading) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0b8793]" /></div>;
  if (isError || !data) return <AdminLogin />;

  const submitCategory = (event: FormEvent) => { event.preventDefault(); if (categoryName.trim()) createCategory.mutate({ name: categoryName }); };
  const submitFeatured = (event: FormEvent) => { event.preventDefault(); if (!featureForm.establishmentId || !featureForm.planId || !featureForm.startsAt || !featureForm.endsAt) return toast.error("Preencha todos os campos do destaque."); const plan = planById.get(Number(featureForm.planId)); if (!plan || plan.code === "basico") return toast.error("Escolha um plano de destaque: dia, semana ou mês."); createFeatured.mutate({ establishmentId: Number(featureForm.establishmentId), planId: Number(featureForm.planId), startsAt: new Date(`${featureForm.startsAt}T00:00:00`), endsAt: new Date(`${featureForm.endsAt}T23:59:59`), displayOrder: Number(featureForm.displayOrder || 0) }); };
  const submitPixSettings = (event: FormEvent) => { event.preventDefault(); const dailyHighlightCapacity = Number(pixForm.dailyHighlightCapacity); if (!Number.isInteger(dailyHighlightCapacity) || dailyHighlightCapacity < 1 || dailyHighlightCapacity > 100) return toast.error("Informe entre 1 e 100 vagas diárias de Destaque."); updatePaymentSettings.mutate({ pixKey: pixForm.pixKey || null, recipientName: pixForm.recipientName || null, instructions: pixForm.instructions || null, dailyHighlightCapacity }); };

  return <div className="mx-auto max-w-7xl pb-12"><div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Gestão de parceiros</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.045em] text-[#063b43]">Painel do Tô no Sal</h1><p className="mt-2 text-sm text-[#5b7d82]">Organize a vitrine de Salinópolis em um só lugar.</p></div><Button onClick={openCreate} className="h-11 rounded-full bg-[#073c45] px-5 font-bold text-white hover:bg-[#0a5964]"><Plus className="h-4 w-4" /> Novo estabelecimento</Button></div><div className="mb-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{tabItems.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${tab === item.id ? "bg-[#073c45] text-white" : "bg-white text-[#4b7076] ring-1 ring-[#0b6976]/10 hover:bg-[#eaf5f3]"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div>
    {tab === "inicio" && <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Store} label="Estabelecimentos" value={String(data.establishments.length)} detail={`${data.establishments.filter(establishment => establishment.isActive).length} ativos`} /><Metric icon={Tags} label="Categorias" value={String(data.categories.length)} detail="Organize o catálogo" /><Metric icon={CheckCircle2} label="Pagamentos" value={String(paidCount)} detail="Registros pagos" /><Metric icon={Sparkles} label="Destaques" value={String(data.featuredSlots.filter(slot => slot.isActive).length)} detail="Campanhas ativas" /></div><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-[#0b6976]/8"><h2 className="font-display text-2xl text-[#063b43]">Próximos passos</h2><div className="mt-5 grid gap-3">{[{ label: "Crie as categorias", target: "categorias" as AdminTab, done: data.categories.length > 0 }, { label: "Cadastre os parceiros", target: "estabelecimentos" as AdminTab, done: data.establishments.length > 0 }, { label: "Defina seus planos", target: "planos" as AdminTab, done: data.plans.some(plan => plan.priceCents > 0) }].map(item => <button key={item.label} onClick={() => setTab(item.target)} className="flex items-center justify-between rounded-xl bg-[#f2f9f7] p-4 text-left transition hover:bg-[#e5f4f1]"><span className="flex items-center gap-3 font-semibold text-[#285961]">{item.done ? <CheckCircle2 className="h-5 w-5 text-[#1b9567]" /> : <span className="h-5 w-5 rounded-full border-2 border-[#83bbb8]" />}{item.label}</span><ChevronRight className="h-4 w-4 text-[#0b8793]" /></button>)}</div></section><section className="relative overflow-hidden rounded-[1.5rem] bg-[#073c45] p-6 text-white"><BeachPlaceholder className="absolute inset-0 opacity-30" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f4cf7c]">Vitrine pública</p><h2 className="mt-2 max-w-sm font-display text-3xl leading-tight">Seu catálogo aparece para quem está em Salinópolis.</h2><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#073c45]">Ver página pública <ChevronRight className="h-4 w-4" /></Link></div></section></div></div>}
    {tab === "estabelecimentos" && <section className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><div className="flex items-center justify-between gap-4"><div><h2 className="font-display text-2xl text-[#063b43]">Estabelecimentos</h2><p className="mt-1 text-sm text-[#648187]">Fotos, contato, localização e disponibilidade de cada parceiro.</p></div><Button onClick={openCreate} size="sm" className="rounded-full bg-[#073c45] text-white"><Plus className="h-4 w-4" /> Adicionar</Button></div>{data.establishments.length ? <div className="mt-5 grid gap-3">{data.establishments.map(establishment => <article key={establishment.id} className="flex flex-col gap-4 rounded-2xl border border-[#e0efec] p-4 sm:flex-row sm:items-center"><div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-[#dcefed]">{establishment.images[0] ? <img src={establishment.images[0]} alt="" className="h-full w-full object-cover" /> : <BeachPlaceholder className="h-full w-full" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-display text-xl text-[#063b43]">{establishment.name}</h3><span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${establishment.isActive ? "bg-[#ddf5e8] text-[#17734d]" : "bg-[#e9eeee] text-[#52666a]"}`}>{establishment.isActive ? "ativo" : "inativo"}</span></div><p className="mt-1 text-sm text-[#5d7e83]">{establishment.categoryName} · {establishment.isDeliveryOnly ? "somente entrega" : [establishment.neighborhood, establishment.streetAddress].filter(Boolean).join(" · ") || "endereço pendente"}</p></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => openEdit(establishment)} aria-label={`Editar ${establishment.name}`} className="rounded-full"><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => { if (confirm(`Remover ${establishment.name}?`)) deleteEstablishment.mutate({ id: establishment.id }); }} aria-label={`Excluir ${establishment.name}`} className="rounded-full text-destructive"><Trash2 className="h-4 w-4" /></Button></div></article>)}</div> : <EmptyAdmin icon={Store} title="Nenhum parceiro cadastrado" text="Comece adicionando o primeiro estabelecimento da sua vitrine." action="Criar estabelecimento" onAction={openCreate} />}</section>}
    {tab === "categorias" && <section className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><h2 className="font-display text-2xl text-[#063b43]">Categorias</h2><p className="mt-1 text-sm text-[#648187]">São os filtros usados pelos visitantes no catálogo.</p><form onSubmit={submitCategory} className="mt-5 flex flex-col gap-3 sm:flex-row"><Input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Ex.: Alimentação" className="h-11" /><Button type="submit" disabled={createCategory.isPending} className="h-11 rounded-full bg-[#073c45] text-white"><Plus className="h-4 w-4" /> Criar categoria</Button></form><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.categories.map(category => <div key={category.id} className="flex items-center justify-between rounded-2xl bg-[#f2f9f7] p-4"><div><p className="font-bold text-[#164e57]">{category.name}</p><p className="mt-1 text-xs text-[#668589]">/{category.slug}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => updateCategory.mutate({ id: category.id, isActive: !category.isActive })} aria-label="Ativar ou desativar categoria" className={category.isActive ? "text-[#1a9468]" : "text-[#8a989a]"}><CheckCircle2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover a categoria ${category.name}?`)) deleteCategory.mutate({ id: category.id }); }} aria-label="Excluir categoria" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div></div>)}</div></section>}
    {tab === "planos" && <section className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><h2 className="font-display text-2xl text-[#063b43]">Planos e preços</h2><p className="mt-1 text-sm text-[#648187]">Defina o preço do plano <strong>básico</strong> e dos destaques por <strong>dia</strong>, <strong>semana</strong> e <strong>mês</strong>.</p><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{data.plans.map(plan => <article key={plan.id} className={`rounded-2xl p-5 ring-1 ${plan.code === "basico" ? "bg-[#edf7f5] ring-[#b8ddd7]" : "bg-[#073c45] text-white ring-[#073c45]"}`}><p className={`text-xs font-extrabold uppercase tracking-[0.17em] ${plan.code === "basico" ? "text-[#0b7e8a]" : "text-[#f4cf7c]"}`}>{plan.label}</p><p className="mt-3 font-display text-3xl">{toCurrency(plan.priceCents)}</p><p className={`mt-1 text-sm ${plan.code === "basico" ? "text-[#5a7d82]" : "text-[#c4dedc]"}`}>{plan.durationDays ? `${plan.durationDays} ${plan.durationDays === 1 ? "dia" : "dias"} de visibilidade` : "Presença regular na vitrine"}</p><div className="mt-5 grid gap-2"><Label className={plan.code === "basico" ? "text-[#416c71]" : "text-[#d6ecea]"}>Preço em R$</Label><Input type="number" min="0" step="0.01" defaultValue={(plan.priceCents / 100).toFixed(2)} onBlur={event => updatePlan.mutate({ id: plan.id, priceCents: Math.round(Number(event.target.value || 0) * 100), isActive: plan.isActive })} className={plan.code === "basico" ? "bg-white" : "border-white/25 bg-white/10 text-white"} /><label className={`mt-2 flex items-center gap-2 text-sm font-semibold ${plan.code === "basico" ? "text-[#416c71]" : "text-[#d6ecea]"}`}><input type="checkbox" defaultChecked={plan.isActive} onChange={event => updatePlan.mutate({ id: plan.id, priceCents: plan.priceCents, isActive: event.target.checked })} className="accent-[#dca041]" />Plano ativo</label></div></article>)}</div></section>}
    {tab === "mensalidades" && <section className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Ciclo automático</p><h2 className="mt-1 font-display text-2xl text-[#063b43]">Mensalidades e renovações</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#648187]">As cobranças PIX são geradas automaticamente no cadastro e cinco dias antes de cada vencimento. Aqui, acompanhe o histórico; a confirmação dos comprovantes acontece na aba PIX.</p><div className="mt-5 grid gap-3">{data.subscriptions.length ? data.subscriptions.map(subscription => <article key={subscription.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e0efec] p-4 sm:flex-row sm:items-center"><div><p className="font-semibold text-[#164e57]">{establishmentById.get(subscription.establishmentId)?.name ?? "Estabelecimento"}</p><p className="mt-1 text-sm text-[#648187]">{planById.get(subscription.planId)?.label ?? "Plano"} · vence em {new Date(subscription.dueAt).toLocaleDateString("pt-BR")}</p></div><div className="flex items-center gap-3"><strong className="text-[#174e57]">{toCurrency(subscription.amountCents)}</strong><StatusPill status={subscription.status} /></div></article>) : <EmptyAdmin icon={WalletCards} title="Nenhuma mensalidade registrada" text="As assinaturas confirmadas aparecerão aqui automaticamente." />}</div></section>}
    {tab === "pix" && <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]"><form onSubmit={submitPixSettings} className="rounded-[1.5rem] bg-[#073c45] p-5 text-white shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f4cf7c]">Recebimento</p><h2 className="mt-1 font-display text-2xl">Dados PIX</h2><p className="mt-2 text-sm leading-6 text-[#c4dedc]">Estes dados são exibidos no portal do parceiro quando ele solicita assinatura ou destaque.</p><div className="mt-5 grid gap-3"><Field label="Nome do recebedor"><Input value={pixForm.recipientName} onChange={event => setPixForm(current => ({ ...current, recipientName: event.target.value }))} className="border-white/25 bg-white/10 text-white" /></Field><Field label="Chave PIX"><Input value={pixForm.pixKey} onChange={event => setPixForm(current => ({ ...current, pixKey: event.target.value }))} className="border-white/25 bg-white/10 text-white" /></Field><Field label="Instruções"><Textarea value={pixForm.instructions} onChange={event => setPixForm(current => ({ ...current, instructions: event.target.value }))} className="border-white/25 bg-white/10 text-white" placeholder="Ex.: envie o comprovante neste painel." /></Field><Field label="Vagas diárias de Destaque"><Input type="number" min="1" max="100" value={pixForm.dailyHighlightCapacity} onChange={event => setPixForm(current => ({ ...current, dailyHighlightCapacity: event.target.value }))} className="border-white/25 bg-white/10 text-white" /></Field><Button type="submit" disabled={updatePaymentSettings.isPending} className="mt-2 rounded-full bg-[#f4cf7c] text-[#073c45] hover:bg-[#ffe3a0]">Salvar dados PIX</Button></div></form><div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d68d20]">Confirmação administrativa</p><h2 className="mt-1 font-display text-2xl text-[#063b43]">Solicitações PIX</h2><p className="mt-2 text-sm text-[#648187]">Confirme somente após conferir o comprovante. A confirmação ativa ou renova assinatura, ou agenda o destaque.</p><div className="mt-5 grid gap-3">{paymentRequests.map(request => <article key={request.id} className="rounded-2xl border border-[#e0efec] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#164e57]">{request.establishmentName}</h3><span className="rounded-full bg-[#edf7f5] px-2.5 py-1 text-[0.65rem] font-extrabold text-[#0b7e8a]">{request.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-[#648187]">{request.purpose === "assinatura" ? "Assinatura" : "Destaque"} · {toCurrency(request.amountCents)} · solicitado por {request.requesterName || "parceiro"}</p>{request.ownerNote && <p className="mt-2 text-xs leading-5 text-[#5b7d82]">Mensagem: {request.ownerNote}</p>}</div>{request.pixProofUrl && <a href={request.pixProofUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#0b7e8a]/25 px-3 py-2 text-xs font-bold text-[#0b7e8a]">Ver comprovante <ChevronRight className="h-3.5 w-3.5" /></a>}</div>{request.status === "em_analise" && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => confirmPaymentRequest.mutate({ requestId: request.id })} disabled={confirmPaymentRequest.isPending} className="rounded-full bg-[#0e916e] text-white hover:bg-[#087454]"><CheckCircle2 className="h-4 w-4" />Confirmar pagamento</Button><Button size="sm" variant="outline" onClick={() => rejectPaymentRequest.mutate({ requestId: request.id })} disabled={rejectPaymentRequest.isPending} className="rounded-full text-destructive">Recusar</Button></div>}{request.adminNote && <p className="mt-3 text-xs text-[#648187]">Nota interna: {request.adminNote}</p>}</article>)}{!paymentRequests.length && <EmptyAdmin icon={CircleDollarSign} title="Sem solicitações PIX" text="Os pedidos enviados pelos parceiros aparecerão nesta fila." />}</div></div></section>}
    {tab === "destaques" && <section className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><div className="grid gap-7 xl:grid-cols-[0.78fr_1.22fr]"><form onSubmit={submitFeatured} className="rounded-2xl bg-[#073c45] p-5 text-white"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f4cf7c]">Vitrine patrocinada</p><h2 className="mt-1 font-display text-2xl">Agendar destaque</h2><div className="mt-5 grid gap-3"><SelectField dark label="Estabelecimento" value={featureForm.establishmentId} onChange={value => setFeatureForm(current => ({ ...current, establishmentId: value }))} options={data.establishments.filter(item => item.isActive).map(item => ({ value: String(item.id), label: item.name }))} /><SelectField dark label="Plano" value={featureForm.planId} onChange={value => setFeatureForm(current => ({ ...current, planId: value }))} options={data.plans.filter(item => item.code !== "basico" && item.isActive).map(item => ({ value: String(item.id), label: `${item.label} · ${toCurrency(item.priceCents)}` }))} /><div className="grid grid-cols-2 gap-3"><Field label="Início"><Input type="date" value={featureForm.startsAt} onChange={event => setFeatureForm(current => ({ ...current, startsAt: event.target.value }))} className="border-white/25 bg-white/10 text-white" /></Field><Field label="Fim"><Input type="date" value={featureForm.endsAt} onChange={event => setFeatureForm(current => ({ ...current, endsAt: event.target.value }))} className="border-white/25 bg-white/10 text-white" /></Field></div><Field label="Ordem"><Input type="number" min="0" value={featureForm.displayOrder} onChange={event => setFeatureForm(current => ({ ...current, displayOrder: event.target.value }))} className="border-white/25 bg-white/10 text-white" /></Field><Button type="submit" className="mt-2 rounded-full bg-[#f4cf7c] text-[#073c45] hover:bg-[#ffe3a0]"><Sparkles className="h-4 w-4" /> Agendar</Button></div></form><div><h2 className="font-display text-2xl text-[#063b43]">Campanhas de destaque</h2><div className="mt-4 grid gap-3">{data.featuredSlots.length ? data.featuredSlots.map(slot => <article key={slot.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e0efec] p-4 sm:flex-row sm:items-center"><div><p className="font-semibold text-[#164e57]">{establishmentById.get(slot.establishmentId)?.name ?? "Estabelecimento"}</p><p className="mt-1 text-sm text-[#648187]">{planById.get(slot.planId)?.label ?? "Plano"} · {new Date(slot.startsAt).toLocaleDateString("pt-BR")} a {new Date(slot.endsAt).toLocaleDateString("pt-BR")}</p></div><label className="flex items-center gap-2 text-sm font-bold text-[#38656c]"><input checked={slot.isActive} type="checkbox" onChange={event => updateFeatured.mutate({ id: slot.id, isActive: event.target.checked })} className="h-4 w-4 accent-[#0a7c87]" />Ativo</label></article>) : <EmptyAdmin icon={Sparkles} title="Nenhum destaque agendado" text="Escolha um parceiro, um plano de dia, semana ou mês e o período de exibição." />}</div></div></div></section>}
    {tab === "imoveis" && <AdminPropertiesPanel />}
    {tab === "mural" && <AdminMuralPanel />}
    <EstablishmentDialog open={establishmentDialog} onOpenChange={setEstablishmentDialog} initial={editing} categories={data.categories} />
  </div>;
}

function SelectField({ label, value, onChange, options, dark = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; dark?: boolean }) { return <Field label={label}><select value={value} onChange={event => onChange(event.target.value)} className={`h-10 w-full rounded-md border px-3 text-sm ${dark ? "border-white/25 bg-white/10 text-white" : "border-input bg-transparent"}`}><option value="" className="text-[#063b43]">Selecione</option>{options.map(option => <option className="text-[#063b43]" key={option.value} value={option.value}>{option.label}</option>)}</select></Field>; }

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Store; label: string; value: string; detail: string }) { return <article className="rounded-[1.35rem] bg-white p-5 shadow-sm ring-1 ring-[#0b6976]/8"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf6f3] text-[#0a7d88]"><Icon className="h-5 w-5" /></span><span className="text-xs font-bold text-[#6a898d]">{detail}</span></div><p className="mt-5 font-display text-4xl text-[#063b43]">{value}</p><p className="mt-1 text-sm font-semibold text-[#5a7d82]">{label}</p></article>; }

function EmptyAdmin({ icon: Icon, title, text, action, onAction }: { icon: typeof Store; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-dashed border-[#a7d2cd] bg-[#f2f9f7] p-6 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[#0a7d88] shadow-sm"><Icon className="h-5 w-5" /></span><h3 className="mt-3 font-display text-xl text-[#164e57]">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#638187]">{text}</p>{action && onAction && <Button onClick={onAction} variant="outline" className="mt-4 rounded-full border-[#0b7e8a]/25 text-[#0b7e8a]">{action}</Button>}</div></div>; }

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const login = trpc.adminAccess.login.useMutation({
    onSuccess: async ({ token }) => {
      localStorage.setItem("to-no-sal-admin-token", token);
      await Promise.all([utils.auth.me.invalidate(), utils.admin.overview.invalidate()]);
      toast.success("Acesso liberado.");
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ email, password }); };
  return <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center text-center"><div className="w-full"><Brand className="justify-center" /><h1 className="mt-8 font-display text-3xl text-[#063b43]">Gestão protegida</h1><p className="mt-3 leading-6 text-[#5a7d82]">Entre com as credenciais administrativas do Tô no Sal.</p><form onSubmit={submit} className="mt-6 grid gap-3 rounded-[1.5rem] bg-white p-5 text-left shadow-sm ring-1 ring-[#0b6976]/8"><Field label="E-mail"><Input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></Field><Field label="Senha"><Input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></Field><Button type="submit" disabled={login.isPending} className="mt-2 h-11 rounded-full bg-[#073c45] text-white hover:bg-[#0a5964]">{login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Entrar no painel</Button></form><Link href="/" className="mt-5 inline-flex text-sm font-bold text-[#0b7e8a]">Voltar à vitrine pública</Link></div></div>;
}

export default function Admin() { return <DashboardLayout allowUnauthenticated><AdminContent /></DashboardLayout>; }
