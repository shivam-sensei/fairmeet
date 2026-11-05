import type { FairSpotResponse, LocationPoint, RerouteResponse, Venue } from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";
const ROUTING_PROFILE = (profile: string) => profile === "metro" ? "driving-car" : profile;

function isFairSpotResponse(value: unknown): value is FairSpotResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  const fairPoint = response.fair_point;
  return (
    !!fairPoint &&
    typeof fairPoint === "object" &&
    typeof (fairPoint as Record<string, unknown>).lat === "number" &&
    typeof (fairPoint as Record<string, unknown>).lng === "number" &&
    Array.isArray(response.venues)
  );
}

export async function getFairMeetupSpot(
  locations: LocationPoint[],
  profile: string,
  overrideTarget?: { lat: number; lng: number },
  category = "veg",
): Promise<FairSpotResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/v1/fair-spot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations, profile: ROUTING_PROFILE(profile), override_target: overrideTarget, category }),
    });
  } catch {
    throw new Error(
      "Unable to reach FairMeet. Check that the backend is running and try again.",
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ? `: ${body.detail}` : "";
    } catch {
      // The status text is sufficient when the server does not return JSON.
    }
    throw new Error(`FairMeet could not calculate a spot (${response.status})${detail}.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The FairMeet backend returned an invalid response.");
  }

  if (!isFairSpotResponse(data)) {
    throw new Error("The FairMeet backend returned an incomplete meetup result.");
  }

  return data;
}

export async function getFilteredVenues(
  lat: number,
  lng: number,
  category: string,
  radius = 800,
): Promise<Venue[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/venues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, category, radius }),
  });
  if (!response.ok) throw new Error("Failed to fetch venues.");
  return response.json() as Promise<Venue[]>;
}

export async function rerouteToVenue(
  origins: Pick<LocationPoint, "lat" | "lng" | "id" | "label">[],
  destination: { lat: number; lng: number },
  profile = "driving-car",
): Promise<RerouteResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/reroute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origins, destination, profile: ROUTING_PROFILE(profile) }),
    });
  } catch {
    throw new Error("Unable to reach FairMeet while rerouting to this venue.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ? `: ${body.detail}` : "";
    } catch {
      // Use the status when the server does not return JSON.
    }
    throw new Error(`FairMeet could not reroute to this venue (${response.status})${detail}.`);
  }

  return response.json() as Promise<RerouteResponse>;
}
