import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import { Link } from "wouter";

type MapEstablishment = { id: number; name: string; slug: string; categoryName: string; latitude: number | null; longitude: number | null; isDemo?: boolean };
type Position = { latitude: number; longitude: number } | null;

const salinopolis = { latitude: -0.6133, longitude: -47.3572 };

function AutoBounds({ places, position }: { places: MapEstablishment[]; position: Position }) {
  const map = useMap();
  useEffect(() => {
    const points = [...places.map(place => [place.latitude, place.longitude] as [number, number]), ...(position ? [[position.latitude, position.longitude] as [number, number]] : [])];
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 14 });
  }, [map, places, position]);
  return null;
}

export default function SurfMap({ places, position }: { places: MapEstablishment[]; position: Position }) {
  const mappedPlaces = places.filter((place): place is MapEstablishment & { latitude: number; longitude: number } => place.latitude !== null && place.longitude !== null);
  return <section className="overflow-hidden rounded-[1.6rem] bg-white shadow-[0_20px_42px_rgba(6,59,67,0.1)] ring-1 ring-[#0b6976]/10"><div className="flex flex-col justify-between gap-3 px-5 pb-4 pt-5 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.17em] text-[#d68d20]">Perto de você</p><h2 className="mt-1 font-display text-3xl tracking-[-0.045em] text-[#063b43]">Mapa de Salinas</h2></div><p className="text-xs leading-5 text-[#668589]">Toque em um ponto para conhecer o parceiro.</p></div><div className="h-[330px] overflow-hidden border-t border-[#e1efec] sm:h-[390px]"><MapContainer center={[salinopolis.latitude, salinopolis.longitude]} zoom={13} scrollWheelZoom={false} className="h-full w-full" aria-label="Mapa de estabelecimentos em Salinópolis"><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' /><AutoBounds places={mappedPlaces} position={position} />{position && <><Circle center={[position.latitude, position.longitude]} radius={650} pathOptions={{ color: "#0b8793", fillColor: "#0b8793", fillOpacity: 0.1, weight: 1 }} /><CircleMarker center={[position.latitude, position.longitude]} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#0b8793", fillOpacity: 1, weight: 3 }}><Tooltip direction="top">Você está aqui</Tooltip></CircleMarker></>}{mappedPlaces.map(place => <CircleMarker key={place.id} center={[place.latitude, place.longitude]} radius={10} pathOptions={{ color: "#ffffff", fillColor: place.isDemo ? "#d99123" : "#073c45", fillOpacity: 1, weight: 3 }}><Tooltip direction="top" offset={[0, -8]}>{place.name}</Tooltip><Popup><div className="min-w-36"><strong className="text-[#063b43]">{place.name}</strong><p className="mb-2 mt-1 text-xs text-[#527177]">{place.categoryName}{place.isDemo ? " · demo" : ""}</p><Link href={`/estabelecimento/${place.slug}`} className="text-xs font-bold text-[#0a7e89]">Ver estabelecimento</Link></div></Popup></CircleMarker>)}</MapContainer></div></section>;
}
