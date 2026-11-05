import type { LocationSearchResult } from "@/types";

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "in",
    limit: "5",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error("Location search is temporarily unavailable.");
  }

  const results: unknown = await response.json();
  if (!Array.isArray(results)) return [];

  return results.flatMap((result) => {
    if (!result || typeof result !== "object") return [];
    const item = result as Record<string, unknown>;
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    return typeof item.display_name === "string" && Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ displayName: item.display_name, lat, lng }]
      : [];
  });
}
