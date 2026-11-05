"use client";

import { useCallback, useEffect, useState } from "react";
import Map from "@/app/components/Map";
import Sidebar from "@/app/components/Sidebar";
import { getFairMeetupSpot, rerouteToVenue } from "@/lib/api";
import type { FairSpotResponse, LocationPoint, LocationSearchResult, Venue } from "@/types";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ea580c"];

export default function Home() {
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [profile, setProfile] = useState("driving-car");
  const [result, setResult] = useState<FairSpotResponse | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<Pick<LocationPoint, "lat" | "lng"> | null>(null);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restored = Array.from(params.keys())
      .filter((key) => /^f\d+$/.test(key))
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .flatMap((key, index) => {
      const value = params.get(key);
      if (!value) return [];
      const [lat, lng] = value.split(",").map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng)
        ? [{ id: `friend-${key.slice(1)}`, label: `Friend ${index + 1}`, lat, lng, color: COLORS[index % COLORS.length] }]
        : [];
      });
    if (restored.length) setLocations(restored);
    const restoredProfile = params.get("profile");
    if (restoredProfile) setProfile(restoredProfile);
    const restoredVenue = params.get("venue");
    if (restoredVenue) setSelectedVenueId(restoredVenue);
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    locations.forEach((location, index) => params.set(`f${index + 1}`, `${location.lat},${location.lng}`));
    params.set("profile", profile);
    if (selectedVenueId) params.set("venue", selectedVenueId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [locations, profile, selectedVenueId, urlReady]);

  const addLocation = useCallback((location: LocationPoint) => {
    setLocations((current) => [...current, { ...location, color: COLORS[current.length % COLORS.length] }]);
    setError(null);
  }, []);

  const addFriend = useCallback(() => {
    setLocations((current) => {
      const index = current.length;
      return [...current, {
        id: `friend-${Date.now()}`,
        label: `Friend ${index + 1}`,
        lat: 28.6139,
        lng: 77.209,
        color: COLORS[index % COLORS.length],
      }];
    });
    setError(null);
  }, []);

  const updateLocation = useCallback((id: string, coordinates: Pick<LocationPoint, "lat" | "lng">) => {
    setLocations((current) => current.map((location) => location.id === id ? { ...location, ...coordinates } : location));
  }, []);

  const updateLabel = useCallback((id: string, label: string) => {
    setLocations((current) => current.map((location) => location.id === id ? { ...location, label } : location));
  }, []);

  const selectLocation = useCallback((id: string, result: LocationSearchResult) => {
    setLocations((current) => current.map((location) => (
      location.id === id ? { ...location, lat: result.lat, lng: result.lng } : location
    )));
    setFlyToTarget({ lat: result.lat, lng: result.lng });
    setResult(null);
  }, []);

  const selectLocationCoordinates = useCallback((id: string, lat: number, lng: number, label: string) => {
    selectLocation(id, { lat, lng, displayName: label });
  }, [selectLocation]);

  const removeLocation = useCallback((id: string) => {
    setLocations((current) => current.filter((location) => location.id !== id).map((location, index) => ({ ...location, color: COLORS[index % COLORS.length] })));
    setResult(null);
  }, []);

  const useCurrentLocation = useCallback((id?: string) => {
    if (!navigator.geolocation) {
      setError("Location access is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocations((current) => {
          if (id) {
            return current.map((location) => location.id === id
              ? { ...location, lat: coords.latitude, lng: coords.longitude }
              : location);
          }
          const index = current.length;
          return [...current, { id: `friend-${Date.now()}`, label: `Friend ${index + 1}`, lat: coords.latitude, lng: coords.longitude, color: COLORS[index % COLORS.length] }];
        });
        setError(null);
      },
      () => setError("We could not access your location. Check browser permissions and try again."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const findSpot = useCallback(async (category = "veg") => {
    setIsLoading(true);
    setError(null);
    try {
      setResult(await getFairMeetupSpot(locations, profile, undefined, category));
      setSelectedVenueId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong while finding your spot.");
    } finally {
      setIsLoading(false);
    }
  }, [locations, profile]);

  const selectVenue = useCallback(async (venue: Venue) => {
    setIsLoading(true);
    setError(null);
    setSelectedVenueId(venue.id);
    try {
      const rerouted = await rerouteToVenue(locations, {
        lat: venue.lat,
        lng: venue.lng,
      }, profile);
      setResult((current) => ({
        fair_point: rerouted.destination,
        isochrone_geojson: current?.isochrone_geojson,
        routes: rerouted.routes,
        venues: current?.venues ?? [],
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong while snapping to this venue.");
    } finally {
      setIsLoading(false);
    }
  }, [locations, profile]);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Map
        locations={locations}
        fairPoint={result?.fair_point ?? null}
        isochrone={result?.isochrone_geojson}
        routes={result?.routes ?? []}
        venues={result?.venues ?? []}
        selectedVenueId={selectedVenueId}
        flyToTarget={flyToTarget}
        onAddLocation={addLocation}
        onUpdateLocation={updateLocation}
        onSelectVenue={selectVenue}
      />
      <Sidebar
        locations={locations}
        profile={profile}
        fairPoint={result?.fair_point ?? null}
        routes={result?.routes ?? []}
        venues={result?.venues ?? []}
        selectedVenueId={selectedVenueId}
        isLoading={isLoading}
        error={error}
        onLabelChange={updateLabel}
        onRemove={removeLocation}
        onUseCurrentLocation={useCurrentLocation}
        onProfileChange={setProfile}
        onFindSpot={findSpot}
        onSelectVenue={selectVenue}
        onLocationSelect={selectLocationCoordinates}
        onAddFriend={addFriend}
        onVenuesChange={(venues) => setResult((current) => current ? { ...current, venues } : current)}
      />
    </main>
  );
}
