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
];

export default function Sidebar({
  locations, profile, fairPoint, routes, venues, selectedVenueId, isLoading, error,
  onLabelChange, onLocationSelect, onAddFriend, onRemove, onUseCurrentLocation, onProfileChange,
  onFindSpot, onSelectVenue,
  onVenuesChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState("veg");
  const [venuesLoading, setVenuesLoading] = useState(false);
  const shareText = `FairMeet meetup for ${locations.length} friends.\n${routes.map((route) => `${route.friend_id}: ${route.duration_minutes}m, ~₹${route.estimated_cab_fare_inr} cab`).join("\n")}`;
  const activeVenue = venues.find((venue) => venue.id === selectedVenueId);
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
    <aside className={`absolute inset-x-3 bottom-3 z-10 flex max-h-[calc(100vh-1.5rem)] flex-col rounded-2xl border border-slate-200/80 bg-white/90 text-slate-800 shadow-2xl backdrop-blur-md transition-all md:inset-y-4 md:left-4 md:right-auto md:w-96 ${collapsed ? "max-h-14 overflow-hidden" : "overflow-y-auto"}`}>
      <button type="button" className="flex items-center justify-between p-4 text-left md:cursor-default" onClick={() => setCollapsed((value) => !value)}>
        <span>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">FairMeet <span className="ml-1 rounded-full bg-blue-50 px-2 py-1 text-[9px] tracking-normal text-blue-700">Fair Point Coordinator</span></span>
          <span className="mt-1 block text-lg font-bold tracking-tight">Meet in the middle</span>
          <span className="block text-xs text-slate-500">Find the fairest meetup spot between friends</span>
        </span>
        <span className="text-slate-400 md:hidden">{collapsed ? "⌃" : "⌄"}</span>
      </button>

      <div className="space-y-5 px-4 pb-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Friends ({locations.length})</h2>
            <button type="button" onClick={onAddFriend} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">+ Add Friend</button>
          </div>
          <div className="space-y-3">
            {locations.map((location, index) => {
              const route = routes.find((item) => item.friend_id === location.id);
              return (
                <div key={location.id} className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: location.color }} />
                    <input value={location.label} onChange={(event) => onLabelChange(location.id, event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" aria-label={`Friend ${index + 1} label`} />
                    <button
                      type="button"
                      onClick={() => onRemove(location.id)}
                      className="text-sm text-slate-400 hover:text-red-600"
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
                  {route && <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold text-slate-600"><span className="rounded-full bg-white px-2 py-1">⏱ {route.duration_minutes}m</span><span className="rounded-full bg-white px-2 py-1">📍 {route.distance_km}km</span><span className="rounded-full bg-amber-50 px-2 py-1">🛺 ~₹{route.estimated_auto_fare_inr}</span><span className="rounded-full bg-slate-200 px-2 py-1">🚗 ~₹{route.estimated_cab_fare_inr}</span></div>}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Click the map or add a friend, then search or use the location button</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Travel mode</h2>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {profiles.map((option) => <button type="button" key={option.value} onClick={() => onProfileChange(option.value)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${profile === option.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{option.icon} {option.label}</button>)}
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <button type="button" onClick={() => onFindSpot(activeCategory)} disabled={locations.length < 2 || isLoading} title={locations.length < 2 ? "Add at least two friends first" : undefined} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-medium text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300">
          {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {isLoading ? "Calculating routes…" : "Find Fair Meetup Spot"}
        </button>

        {fairPoint && <section className="border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-start justify-between gap-2"><div><h2 className="font-bold">Meetup destination</h2><p className="mt-1 font-mono text-[10px] text-slate-500">{fairPoint.lat.toFixed(5)}, {fairPoint.lng.toFixed(5)}</p></div><span className="text-xl">★</span></div>
          <ShareButton text={shareText} fairPoint={fairPoint} venueName={activeVenue?.name} />
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommended spots</h3>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {categories.map((category) => <button type="button" key={category.value} onClick={() => void selectCategory(category.value)} className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-semibold ${activeCategory === category.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{category.label}</button>)}
            </div>
            {venuesLoading ? <div className="space-y-2"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /></div> : venues.map((venue) => <VenueCard key={venue.id} venue={venue} isSelected={selectedVenueId === venue.id} onSelect={onSelectVenue} />)}
          </div>
        </section>}
      </div>
    </aside>
  );
}
