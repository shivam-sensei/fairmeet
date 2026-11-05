"use client";

import { useState } from "react";
import { getFilteredVenues } from "@/lib/api";
import LocationSearchInput from "@/app/components/LocationSearchInput";
import ShareButton from "@/app/components/ShareButton";
import VenueCard from "@/app/components/VenueCard";
import type { FriendRouteSummary, LocationPoint, Venue } from "@/types";

interface SidebarProps {
  locations: LocationPoint[];
  profile: string;
  fairPoint: { lat: number; lng: number } | null;
  routes: FriendRouteSummary[];
  venues: Venue[];
  selectedVenue: Venue | null;
  selectedVenueId: string | null;
  isLoading: boolean;
  error: string | null;
  onLabelChange: (id: string, label: string) => void;
  onLocationSelect: (id: string, lat: number, lng: number, label: string) => void;
  onAddFriend: () => void;
  onRemove: (id: string) => void;
  onUseCurrentLocation: (id?: string) => void;
  onProfileChange: (profile: string) => void;
  onFindSpot: (category: string) => void;
  onSelectVenue: (venue: Venue) => void;
  onVenuesChange: (venues: Venue[]) => void;
}

const profiles = [
  { value: "driving-car", label: "Driving", icon: "🚗" },
  { value: "foot-walking", label: "Walking", icon: "🚶" },
  { value: "cycling-regular", label: "Cycling", icon: "🚲" },
  { value: "metro", label: "Metro", icon: "🚇" },
];

function getLineBadgeColor(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes("yellow")) return "bg-amber-400 text-amber-950";
  if (normalized.includes("blue")) return "bg-blue-600 text-white";
  if (normalized.includes("red")) return "bg-red-600 text-white";
  if (normalized.includes("pink")) return "bg-pink-500 text-white";
  if (normalized.includes("magenta")) return "bg-purple-600 text-white";
  if (normalized.includes("violet")) return "bg-violet-700 text-white";
  if (normalized.includes("airport")) return "bg-orange-600 text-white";
  if (normalized.includes("rapid")) return "bg-sky-500 text-white";
  return "bg-slate-200 text-slate-800";
}

export default function Sidebar({
  locations, profile, fairPoint, routes, venues, selectedVenue, selectedVenueId, isLoading, error,
  onLabelChange, onLocationSelect, onAddFriend, onRemove, onUseCurrentLocation, onProfileChange,
  onFindSpot, onSelectVenue,
  onVenuesChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState("veg");
  const [venuesLoading, setVenuesLoading] = useState(false);
  const shareText = `FairMeet meetup for ${locations.length} friends.\n${routes.map((route) => `${route.friend_id}: ${route.duration_minutes}m, ~₹${route.estimated_cab_fare_inr} cab`).join("\n")}`;
  const activeVenue = selectedVenue ?? venues.find((venue) => venue.id === selectedVenueId);
  const categories = [
    { value: "veg", label: "🥗 Veg" },
    { value: "all", label: "All Spots" },
    { value: "cafes", label: "☕ Cafes" },
    { value: "quick_bites", label: "🍔 Quick Bites" },
    { value: "dining", label: "🍽 Dining" },
  ];

  const selectCategory = async (category: string) => {
    if (!fairPoint || category === activeCategory) return;
    setActiveCategory(category);
    setVenuesLoading(true);
    try {
      onVenuesChange(await getFilteredVenues(fairPoint.lat, fairPoint.lng, category));
    } catch {
      // Keep the previous venue list visible when the filter request fails.
    } finally {
      setVenuesLoading(false);
    }
  };

  return (
    <aside className={`absolute inset-x-3 bottom-3 z-10 flex max-h-[calc(100vh-1.5rem)] flex-col rounded-2xl border border-slate-200 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-xl transition-all md:inset-y-0 md:left-0 md:right-auto md:w-[420px] md:max-h-none md:rounded-none md:border-y-0 md:border-l-0 ${collapsed ? "max-h-14 overflow-hidden" : "overflow-y-auto"}`}>
      <button type="button" className="flex items-center justify-between border-b border-slate-100 p-5 text-left md:cursor-default" onClick={() => setCollapsed((value) => !value)}>
        <span>
          <span className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">✦ FairMeet</span>
          <span className="mt-1 block text-xs font-medium text-slate-500">Fair point meetup coordinator</span>
        </span>
        <span className="text-slate-500 md:hidden">{collapsed ? "⌃" : "⌄"}</span>
      </button>

      <div className="space-y-5 overflow-y-auto p-4">
        {selectedVenue && (
          <div className="relative mb-1 overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-4 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/20 blur-xl" />
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />Current Selected Spot</span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-500/30 px-2 py-0.5 text-indigo-200">{selectedVenue.category}</span>
            </div>
            <h2 className="mt-2 truncate text-base font-bold tracking-tight text-white">{selectedVenue.name}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {typeof selectedVenue.rating === "number" && <span className="font-semibold text-amber-400">★ {selectedVenue.rating.toFixed(1)}{typeof selectedVenue.user_ratings_total === "number" && <span className="font-normal text-slate-400"> ({selectedVenue.user_ratings_total.toLocaleString()})</span>}</span>}
              {typeof selectedVenue.distance_from_midpoint_m === "number" && <><span className="text-slate-500">•</span><span className="text-slate-300">{selectedVenue.distance_from_midpoint_m}m from midpoint</span></>}
            </div>
            <div className="mt-3.5 flex items-center gap-2 border-t border-white/10 pt-3">
              <a href={selectedVenue.google_maps_uri ?? `https://www.google.com/maps/search/?api=1&query=${selectedVenue.lat},${selectedVenue.lng}`} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-white/20">Google Maps ↗</a>
              <a href={`uber://?action=setPickup&dropoff[latitude]=${selectedVenue.lat}&dropoff[longitude]=${selectedVenue.lng}`} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100">Uber</a>
            </div>
          </div>
        )}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Friends ({locations.length})</h2>
            <button type="button" onClick={onAddFriend} className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-all hover:bg-indigo-100">+ Add Friend</button>
          </div>
          <div className="space-y-3">
            {locations.map((location, index) => {
              const route = routes.find((item) => item.friend_id === location.id);
              return (
                <div key={location.id} className="mb-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white shadow-sm" style={{ backgroundColor: location.color }}>F{index + 1}</span>
                    <span className="text-sm font-semibold text-slate-800">Friend {index + 1}</span>
                    <input value={location.label} onChange={(event) => onLabelChange(location.id, event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-500 outline-none" aria-label={`Friend ${index + 1} label`} />
                    <button
                      type="button"
                      onClick={() => onRemove(location.id)}
                      className="ml-auto text-lg leading-none text-slate-400 hover:text-rose-500"
                      aria-label={`Remove ${location.label}`}
                      title={`Remove ${location.label}`}
                    >
                      ✕
                    </button>
                  </div>
                  <LocationSearchInput
                    value={searchValues[location.id] ?? ""}
                    onChange={(value) => setSearchValues((current) => ({ ...current, [location.id]: value }))}
                    onSelect={(lat, lng, label) => {
                      setSearchValues((current) => ({ ...current, [location.id]: label }));
                      onLocationSelect(location.id, lat, lng, label);
                    }}
                    onUseCurrentLocation={() => onUseCurrentLocation(location.id)}
                  />
                  <p className="mt-1 font-mono text-[10px] text-slate-500">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
                  {route && <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-medium"><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">⏱ {route.duration_minutes}m ({route.distance_km} km)</span><span className="rounded-md border border-amber-200/60 bg-amber-50 px-2 py-1 font-semibold text-amber-800">🛺 Auto ~₹{route.estimated_auto_fare_inr}</span><span className="rounded-md border border-blue-200/60 bg-blue-50 px-2 py-1 font-semibold text-blue-800">🚕 Cab ~₹{route.estimated_cab_fare_inr}</span></div>
                    {profile === "metro" && route.metro_journey && <details open className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2 text-[11px]">
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1.5 font-semibold text-emerald-950">
                        <span>🚇 Metro · {route.metro_journey.estimated_metro_time_min} mins</span>
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">₹{route.metro_journey.approx_metro_fare_inr}</span>
                      </summary>
                      <div className="relative mt-2 space-y-4 py-3 pl-6 pr-2 text-slate-600 before:absolute before:bottom-4 before:left-2.5 before:top-4 before:w-0.5 before:bg-slate-200">
                        <p className="relative"><span className="absolute -left-[19px] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 shadow-sm" /><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Board At</span><strong className="text-xs text-slate-900">{route.metro_journey.origin_station}</strong><span className="block text-[11px]">First-mile: {route.metro_journey.origin_walk_or_drive_km} km</span></p>
                        {route.metro_journey.interchanges.length > 0
                          ? route.metro_journey.interchanges.map((interchange, interchangeIndex) => <p key={`${interchange.station}-${interchangeIndex}`} className="relative"><span className="absolute -left-[19px] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-500 shadow-sm" /><span className="block text-[10px] font-bold uppercase tracking-wider text-amber-600">Transfer</span><strong className="text-xs text-slate-900">{interchange.station}</strong><span className="mt-1 flex items-center gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getLineBadgeColor(interchange.from_line)}`}>{interchange.from_line}</span><span className="text-slate-500">→</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getLineBadgeColor(interchange.to_line)}`}>{interchange.to_line}</span></span></p>)
                          : <p className="relative font-medium text-emerald-700">✨ Direct line ({route.metro_journey.total_metro_stations} stops)</p>}
                        <p className="relative"><span className="absolute -left-[19px] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow-sm" /><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Exit At</span><strong className="text-xs text-slate-900">{route.metro_journey.destination_station}</strong><span className="block text-[11px]">Last-mile: {route.metro_journey.destination_walk_km} km</span></p>
                      </div>
                    </details>}
                  </div>}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Click the map or add a friend, then search or use the location button</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Travel mode</h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
            {profiles.map((option) => <button type="button" key={option.value} onClick={() => onProfileChange(option.value)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${profile === option.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{option.icon} {option.label}</button>)}
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <button type="button" onClick={() => onFindSpot(activeCategory)} disabled={locations.length < 2 || isLoading} title={locations.length < 2 ? "Add at least two friends first" : undefined} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-medium text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300">
          {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {isLoading ? "Calculating routes…" : "Find Fair Meetup Spot"}
        </button>

        {fairPoint && <section className="border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold">Meetup destination</h2>
              {activeVenue
                ? <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Meetup spot chosen: {activeVenue.name}</p>
                : <p className="mt-1 text-xs font-medium text-slate-500">Fair point calculated between friends</p>}
              <p className="mt-1 font-mono text-[10px] text-slate-500">{fairPoint.lat.toFixed(5)}, {fairPoint.lng.toFixed(5)}</p>
            </div>
            <span className="text-xl text-amber-400">★</span>
          </div>
          <ShareButton text={shareText} fairPoint={fairPoint} venueName={activeVenue?.name} />
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommended spots</h3>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {categories.map((category) => <button type="button" key={category.value} onClick={() => void selectCategory(category.value)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] transition ${activeCategory === category.value ? "bg-slate-900 font-semibold text-white shadow-sm" : "bg-slate-100 font-medium text-slate-600 hover:bg-slate-200"}`}>{category.label}</button>)}
            </div>
            {venuesLoading ? <div className="space-y-2"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /></div> : venues.map((venue) => <VenueCard key={venue.id} venue={venue} isSelected={selectedVenueId === venue.id} onSelect={onSelectVenue} />)}
          </div>
        </section>}
      </div>
    </aside>
  );
}
