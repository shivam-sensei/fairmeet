"use client";

import type { Venue } from "@/types";

interface VenueCardProps {
  venue: Venue;
  isSelected: boolean;
  onSelect: (venue: Venue) => void;
}

function categoryIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("restaurant")) return "🍽";
  if (normalized.includes("fast")) return "🍔";
  return "☕";
}

export default function VenueCard({ venue, isSelected, onSelect }: VenueCardProps) {
  return (
    <article className={`flex cursor-pointer flex-col justify-between rounded-xl p-3.5 shadow-sm transition-all hover:shadow-md ${isSelected ? "border-2 border-indigo-600 bg-indigo-50/70 shadow-md ring-2 ring-indigo-600/20" : "border border-slate-200 bg-white hover:border-slate-300"}`} onClick={() => onSelect(venue)}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{categoryIcon(venue.category)} {venue.category}</span>
          {isSelected ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">✓ Active Target</span> : typeof venue.open_now === "boolean" && <span className={`text-[11px] font-semibold ${venue.open_now ? "text-emerald-700" : "text-rose-600"}`}>● {venue.open_now ? "Open Now" : "Closed"}</span>}
        </div>
          <h3 className={`mt-1 truncate text-sm font-bold ${isSelected ? "text-indigo-950" : "text-slate-900"}`}>{venue.name}</h3>
          {typeof venue.rating === "number" && <p className="text-xs font-semibold text-amber-500">★ {venue.rating.toFixed(1)}{typeof venue.user_ratings_total === "number" && <span> ({venue.user_ratings_total.toLocaleString()})</span>}</p>}
          {typeof venue.distance_from_midpoint_m === "number" && <p className="text-xs text-slate-500">📍 {venue.distance_from_midpoint_m}m from fair spot</p>}
          {typeof venue.price_level === "string" && <p className="text-xs text-emerald-700">{venue.price_level.replace("PRICE_LEVEL_", "").toLowerCase().replace("_", " ")}</p>}
          {venue.distanceMeters !== undefined && <p className="text-xs text-slate-500">{(venue.distanceMeters / 1000).toFixed(1)} km away</p>}
        </div>
      <div className="mt-3 flex gap-2">
        {isSelected ? <div className="flex-1 rounded-lg bg-indigo-100/80 py-1.5 text-center text-xs font-semibold text-indigo-700">Routes End Here</div> : <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(venue); }} className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700">Meet Here Instead</button>}
        <a href={venue.google_maps_uri ?? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50">Google Maps</a>
        <a href={`uber://?action=setPickup&dropoff[latitude]=${venue.lat}&dropoff[longitude]=${venue.lng}`} className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800">Uber</a>
      </div>
    </article>
  );
}
