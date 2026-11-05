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
    <article className={`rounded-xl border p-3 transition ${isSelected ? "border-emerald-400 bg-emerald-50/70" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{categoryIcon(venue.category)} {venue.category}</span>
          <h3 className="mt-1 truncate text-sm font-bold text-slate-800">{venue.name}</h3>
          {typeof venue.rating === "number" && <p className="text-xs text-amber-600">★ {venue.rating.toFixed(1)}{typeof venue.user_ratings_total === "number" && <span className="text-slate-500"> ({venue.user_ratings_total.toLocaleString()} ratings)</span>}</p>}
          {typeof venue.distance_from_midpoint_m === "number" && <p className="text-xs text-slate-500">📍 {venue.distance_from_midpoint_m}m from center</p>}
          {typeof venue.price_level === "string" && <p className="text-xs text-emerald-700">{venue.price_level.replace("PRICE_LEVEL_", "").toLowerCase().replace("_", " ")}</p>}
          {typeof venue.open_now === "boolean" && <p className={`text-xs ${venue.open_now ? "text-emerald-600" : "text-slate-500"}`}>{venue.open_now ? "Open now" : "Closed now"}</p>}
          {venue.distanceMeters !== undefined && <p className="text-xs text-slate-500">{(venue.distanceMeters / 1000).toFixed(1)} km away</p>}
        </div>
        <button type="button" onClick={() => onSelect(venue)} disabled={isSelected} className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-bold ${isSelected ? "bg-emerald-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100"}`}>
          {isSelected ? "✓ Active Destination" : "Meet Here Instead"}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <a href={venue.google_maps_uri ?? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-slate-900 px-2 py-2 text-center text-xs font-semibold text-white hover:bg-slate-700">Google Maps</a>
        <a href={`uber://?action=setPickup&dropoff[latitude]=${venue.lat}&dropoff[longitude]=${venue.lng}`} className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-center text-xs font-semibold text-slate-700 hover:border-violet-500">Uber</a>
      </div>
    </article>
  );
}
