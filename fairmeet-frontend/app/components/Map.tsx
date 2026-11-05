"use client";

import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  Popup,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { FriendRouteSummary, LocationPoint, Venue } from "@/types";

interface MapProps {
  locations: LocationPoint[];
  fairPoint: { lat: number; lng: number } | null;
  isochrone: GeoJSON.FeatureCollection | undefined;
  routes: FriendRouteSummary[];
  venues: Venue[];
  selectedVenueId: string | null;
  flyToTarget: Pick<LocationPoint, "lat" | "lng"> | null;
  onAddLocation: (point: LocationPoint) => void;
  onUpdateLocation: (id: string, coordinates: Pick<LocationPoint, "lat" | "lng">) => void;
  onSelectVenue: (venue: Venue) => void;
}

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ea580c"];

function markerElement(color: string, label: string, index: number) {
  const element = document.createElement("div");
  element.title = label;
  element.textContent = `F${index + 1}`;
  element.style.cssText = `display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 4px ${color}55,0 2px 8px #0005;color:white;font:700 11px Arial;cursor:grab`;
  return element;
}

function venueMarkerElement(venue: Venue, selected: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = venue.category.toLowerCase().includes("cafe") ? "☕" : "🍔";
  element.title = `Select ${venue.name} as meetup spot`;
  element.setAttribute("aria-label", `Select ${venue.name} as meetup spot`);
  element.style.cssText = `display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:2px solid white;border-radius:50%;background:${selected ? "#db2777" : "#7c3aed"};box-shadow:0 2px 8px #0006;font-size:15px;cursor:pointer`;
  return element;
}

export default function Map({
  locations,
  fairPoint,
  isochrone,
  routes,
  venues,
  selectedVenueId,
  flyToTarget,
  onAddLocation,
  onUpdateLocation,
  onSelectVenue,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const locationsRef = useRef(locations);
  const locationMarkersRef = useRef(new globalThis.Map<string, Marker>());
  const venueMarkersRef = useRef(new globalThis.Map<string, { marker: Marker; popup: Popup }>());
  const fairMarkerRef = useRef<Marker | null>(null);
  locationsRef.current = locations;

  useEffect(() => {
    if (!containerRef.current) return;
    setMapReady(false);
    maplibregl.setWorkerUrl(
      new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
    );
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [77.209, 28.6139],
      zoom: 11,
    });
    mapRef.current = map;
    const handleMapReady = () => setMapReady(true);
    if (map.isStyleLoaded()) handleMapReady();
    else map.once("load", handleMapReady);
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");
    map.on("click", (event) => {
      const index = locationsRef.current.length;
      onAddLocation({
        id: `friend-${Date.now()}`,
        label: `Friend ${index + 1}`,
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
        color: COLORS[index % COLORS.length],
      });
    });

    return () => {
      locationMarkersRef.current.forEach((marker) => marker.remove());
      venueMarkersRef.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      fairMarkerRef.current?.remove();
      map.off("load", handleMapReady);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [onAddLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const activeIds = new Set(locations.map((location) => location.id));
    locationMarkersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        locationMarkersRef.current.delete(id);
      }
    });
    locations.forEach((location, index) => {
      let marker = locationMarkersRef.current.get(location.id);
      if (!marker) {
        marker = new maplibregl.Marker({
          element: markerElement(location.color, location.label, index),
          draggable: true,
        })
          .setLngLat([location.lng, location.lat])
          .addTo(map);
        marker.on("dragend", () => {
          const position = marker?.getLngLat();
          if (position) onUpdateLocation(location.id, { lat: position.lat, lng: position.lng });
        });
        locationMarkersRef.current.set(location.id, marker);
      } else {
        marker.setLngLat([location.lng, location.lat]);
        marker.getElement().textContent = `F${index + 1}`;
      }
    });
  }, [locations, onUpdateLocation, mapReady]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !flyToTarget) return;
    mapRef.current.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: Math.max(mapRef.current.getZoom(), 13),
      essential: true,
    });
  }, [flyToTarget, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const updateIsochrone = () => {
      const source = map.getSource("fairmeet-isochrone") as GeoJSONSource | undefined;
      if (isochrone) {
        if (source) source.setData(isochrone);
        else {
          map.addSource("fairmeet-isochrone", { type: "geojson", data: isochrone });
          map.addLayer({ id: "fairmeet-isochrone-fill", type: "fill", source: "fairmeet-isochrone", paint: { "fill-color": "#2563eb", "fill-opacity": 0.25 } });
          map.addLayer({ id: "fairmeet-isochrone-line", type: "line", source: "fairmeet-isochrone", paint: { "line-color": "#2563eb", "line-width": 2, "line-opacity": 0.45 } });
        }
      } else if (source) {
        if (map.getLayer("fairmeet-isochrone-line")) map.removeLayer("fairmeet-isochrone-line");
        if (map.getLayer("fairmeet-isochrone-fill")) map.removeLayer("fairmeet-isochrone-fill");
        map.removeSource("fairmeet-isochrone");
      }
    };
    updateIsochrone();
  }, [isochrone, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const updateRoutes = () => {
      const activeRouteIds = new Set(routes.map((route) => route.friend_id));
      const layers = map.getStyle().layers ?? [];
      layers.forEach((layer) => {
        if (!layer.id.startsWith("fairmeet-route-layer-")) return;
        const friendId = layer.id.replace("fairmeet-route-layer-", "");
        if (!activeRouteIds.has(friendId)) {
          if (map.getLayer(layer.id)) map.removeLayer(layer.id);
          const sourceId = `fairmeet-route-source-${friendId}`;
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      });

      routes.forEach((route) => {
        const sourceId = `fairmeet-route-source-${route.friend_id}`;
        const layerId = `fairmeet-route-layer-${route.friend_id}`;
        const friend = locations.find((location) => location.id === route.friend_id);
        const source = map.getSource(sourceId) as GeoJSONSource | undefined;
        if (source) {
          source.setData(route.route_geojson);
        } else {
          map.addSource(sourceId, { type: "geojson", data: route.route_geojson });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": friend?.color ?? "#2563eb",
              "line-width": 4,
              "line-opacity": 0.85,
            },
          });
        }
        if (map.getLayer(layerId)) map.moveLayer(layerId);
      });
    };

    updateRoutes();
  }, [locations, routes, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || (!locations.length && !fairPoint)) return;
    const points = locations.map((location) => [location.lng, location.lat] as [number, number]);
    if (fairPoint) points.push([fairPoint.lng, fairPoint.lat]);
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 13, duration: 1000 });
      return;
    }
    const bounds = points.reduce(
      (current, point) => current.extend(point),
      new maplibregl.LngLatBounds(points[0], points[0]),
    );
    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 380, right: 50 },
      duration: 1000,
    });
  }, [locations, fairPoint, routes, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    fairMarkerRef.current?.remove();
    fairMarkerRef.current = null;
    if (fairPoint) {
      const element = document.createElement("div");
      element.textContent = "★";
      element.style.cssText = "color:#d97706;font-size:34px;line-height:34px;text-shadow:0 1px 3px #0006;filter:drop-shadow(0 0 6px #f59e0b);animation:fairmeet-pulse 1.6s ease-in-out infinite";
      fairMarkerRef.current = new maplibregl.Marker({ element })
        .setLngLat([fairPoint.lng, fairPoint.lat])
        .addTo(map);
    }
  }, [fairPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const activeIds = new Set(venues.map((venue) => venue.id));
    venueMarkersRef.current.forEach(({ marker, popup }, id) => {
      if (!activeIds.has(id)) {
        popup.remove();
        marker.remove();
        venueMarkersRef.current.delete(id);
      }
    });
    venues.forEach((venue) => {
      const existing = venueMarkersRef.current.get(venue.id);
      if (existing) {
        const element = existing.marker.getElement();
        element.style.backgroundColor = selectedVenueId === venue.id ? "#db2777" : "#7c3aed";
        element.style.transform = selectedVenueId === venue.id ? "rotate(-45deg) scale(1.35)" : "rotate(-45deg)";
        return;
      }
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong>${venue.name}</strong><br /><span>${venue.category}${typeof venue.rating === "number" ? ` · ★ ${venue.rating.toFixed(1)}` : ""}</span><br /><button class="fairmeet-select-venue" style="margin-top:8px;border:0;border-radius:6px;background:#2563eb;color:#fff;padding:5px 8px;font-size:12px;cursor:pointer">Select</button>`,
      );
      const element = venueMarkerElement(venue, selectedVenueId === venue.id);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectVenue(venue);
      });
      popup.on("open", () => {
        const selectButton = popup.getElement()?.querySelector(".fairmeet-select-venue");
        selectButton?.addEventListener("click", () => onSelectVenue(venue));
      });
      const marker = new maplibregl.Marker({ element })
        .setLngLat([venue.lng, venue.lat])
        .setPopup(popup)
        .addTo(map);
      venueMarkersRef.current.set(venue.id, { marker, popup });
    });
  }, [venues, selectedVenueId, onSelectVenue, mapReady]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Meetup map" />;
}
