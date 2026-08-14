import { trpc } from "@/lib/trpc";
import { ArrowDownToLine, ArrowUpToLine, Gauge, Loader2, Waves, Wind } from "lucide-react";

function dayLabel(date: string, index: number) {
  if (index === 0) return "Hoje";
  if (index === 1) return "Amanhã";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", "");
}

function tideTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(`${value}:00`));
}

export default function BeachConditions() {
  const { data, isLoading, isError } = trpc.beach.conditions.useQuery(undefined, { staleTime: 8 * 60 * 1000, retry: 1 });
  if (isLoading) return <section className="overflow-hidden rounded-[1.6rem] bg-[#073c45] p-6 text-white"><Loader2 className="h-6 w-6 animate-spin text-[#f4cf7c]" /></section>;
  if (isError || !data) return null;
  const direction = data.waveDirection === null ? null : `${Math.round(data.waveDirection)}°`;
  const rising = (data.seaLevel ?? 0) >= 0;
  return <section className="relative overflow-hidden rounded-[1.6rem] bg-[#073c45] p-6 text-white shadow-[0_20px_42px_rgba(6,59,67,0.17)] sm:p-7"><div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[25px] border-[#26aeb7]/25" /><div className="relative"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.17em] text-[#f4cf7c]"><Waves className="h-3.5 w-3.5" /> Condições da praia</p><h2 className="mt-2 font-display text-3xl tracking-[-0.045em]">Ondas em Salinas</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#b9d7d5]">Leitura marítima no mar próximo à costa, atualizada periodicamente.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-[#d9efeb]"><span className="h-2 w-2 rounded-full bg-[#f4cf7c]" />Ao vivo</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric icon={Waves} label="Altura" value={data.waveHeight === null ? "—" : `${data.waveHeight.toFixed(1)} m`} /><Metric icon={Gauge} label="Período" value={data.wavePeriod === null ? "—" : `${Math.round(data.wavePeriod)} s`} /><Metric icon={Wind} label="Direção" value={direction ?? "—"} /></div><div className="mt-5 grid gap-2 border-t border-white/10 pt-5 sm:grid-cols-3">{data.days.map((day, index) => <div key={day.date} className="rounded-xl bg-white/8 px-3 py-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9fd6d4]">{dayLabel(day.date, index)}</p><p className="mt-1 font-display text-xl">{day.waveHeight === null ? "—" : `${day.waveHeight.toFixed(1)} m`}</p><p className="text-xs text-[#c2dedb]">máx. · {day.wavePeriod === null ? "—" : `${Math.round(day.wavePeriod)} s`}</p></div>)}</div>{data.tides.length > 0 && <div className="mt-4 rounded-2xl bg-[#0a5964] p-4"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#f4cf7c]">Maré estimada</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.tides.slice(0, 2).map(tide => <div key={`${tide.type}-${tide.time}`} className="flex items-center justify-between rounded-xl bg-white/8 px-3 py-2"><span className="text-xs font-bold uppercase tracking-[0.1em] text-[#bfe0dc]">{tide.type}</span><span className="font-display text-lg">{tideTime(tide.time)} · {tide.height.toFixed(2)} m</span></div>)}</div></div>}<p className="mt-5 flex items-start gap-2 text-[0.7rem] leading-5 text-[#a9cfcc]">{rising ? <ArrowUpToLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f4cf7c]" /> : <ArrowDownToLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f4cf7c]" />}Nível do mar estimado: {data.seaLevel === null ? "indisponível" : `${data.seaLevel.toFixed(2)} m`} em relação ao nível médio. Consulte fontes náuticas oficiais antes de qualquer atividade de navegação.</p></div></section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Waves; label: string; value: string }) { return <div className="rounded-2xl bg-white/9 p-4"><Icon className="h-4 w-4 text-[#f4cf7c]" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#a9cfcc]">{label}</p><p className="mt-1 font-display text-3xl">{value}</p></div>; }
