import { loadMarineSnapshot, saveMarineSnapshot } from "./appStorage";

const SALINOPOLIS_OFFSHORE = { latitude: -0.6132, longitude: -47.3687 };
const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type MarineResponse = {
  current?: {
    time?: string;
    wave_height?: number;
    wave_period?: number;
    wave_direction?: number;
    sea_level_height_msl?: number;
  };
  daily?: {
    time?: string[];
    wave_height_max?: number[];
    wave_period_max?: number[];
  };
  hourly?: {
    time?: string[];
    sea_level_height_msl?: number[];
  };
};

export type BeachConditions = {
  updatedAt: string;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  seaLevel: number | null;
  tides: { type: "alta" | "baixa"; time: string; height: number }[];
  days: { date: string; waveHeight: number | null; wavePeriod: number | null }[];
  source: "Open-Meteo";
  lastFetchedAt: string;
  freshness: "fresh" | "cached" | "stale";
};

let cached: { expiresAt: number; staleUntil: number; data: BeachConditions } | null = null;
let snapshotLoaded = false;

export function resetBeachConditionsCacheForTest() {
  cached = null;
  snapshotLoaded = false;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseBeachConditions(response: MarineResponse): BeachConditions {
  const daily = response.daily;
  const dates = daily?.time ?? [];
  const tideTimes = response.hourly?.time ?? [];
  const tideHeights = response.hourly?.sea_level_height_msl ?? [];
  const tides: BeachConditions["tides"] = [];
  for (let index = 1; index < tideHeights.length - 1; index += 1) {
    const previous = numberOrNull(tideHeights[index - 1]);
    const current = numberOrNull(tideHeights[index]);
    const next = numberOrNull(tideHeights[index + 1]);
    const time = tideTimes[index];
    if (previous === null || current === null || next === null || !time) continue;
    if (current >= previous && current > next) tides.push({ type: "alta", time, height: current });
    if (current <= previous && current < next) tides.push({ type: "baixa", time, height: current });
    if (tides.length >= 4) break;
  }
  return {
    updatedAt: response.current?.time ?? new Date().toISOString(),
    waveHeight: numberOrNull(response.current?.wave_height),
    wavePeriod: numberOrNull(response.current?.wave_period),
    waveDirection: numberOrNull(response.current?.wave_direction),
    seaLevel: numberOrNull(response.current?.sea_level_height_msl),
    tides,
    days: dates.slice(0, 3).map((date, index) => ({
      date,
      waveHeight: numberOrNull(daily?.wave_height_max?.[index]),
      wavePeriod: numberOrNull(daily?.wave_period_max?.[index]),
    })),
    source: "Open-Meteo",
    lastFetchedAt: new Date().toISOString(),
    freshness: "fresh",
  };
}

export async function getBeachConditions(options: { forceRefresh?: boolean } = {}) {
  const now = Date.now();
  if (!snapshotLoaded) {
    snapshotLoaded = true;
    const snapshot = await loadMarineSnapshot();
    const fetchedAt = snapshot ? Date.parse(snapshot.lastFetchedAt) : Number.NaN;
    if (snapshot && Number.isFinite(fetchedAt)) {
      cached = { data: snapshot, expiresAt: fetchedAt + CACHE_TTL_MS, staleUntil: fetchedAt + STALE_CACHE_TTL_MS };
    }
  }
  if (!options.forceRefresh && cached && cached.expiresAt > now) return { ...cached.data, freshness: "cached" as const };
  const parameters = new URLSearchParams({
    latitude: String(SALINOPOLIS_OFFSHORE.latitude),
    longitude: String(SALINOPOLIS_OFFSHORE.longitude),
    hourly: "sea_level_height_msl",
    daily: "wave_height_max,wave_period_max",
    current: "wave_height,wave_period,wave_direction,sea_level_height_msl",
    timezone: "America/Belem",
    forecast_days: "3",
    cell_selection: "sea",
  });
  try {
    const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${parameters}`, {
      headers: { Accept: "application/json", "User-Agent": "ToNoSal/1.0 (+https://github.com/joaocachorro75/to-no-sal)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Não foi possível consultar as condições da praia.");
    const data = parseBeachConditions(await response.json() as MarineResponse);
    cached = { data, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_CACHE_TTL_MS };
    await saveMarineSnapshot(data);
    return data;
  } catch (error) {
    if (cached && cached.staleUntil > now) return { ...cached.data, freshness: "stale" as const };
    throw error;
  }
}
