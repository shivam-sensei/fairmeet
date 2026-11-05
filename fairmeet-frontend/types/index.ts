export interface LocationPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color: string;
}

export interface LocationSearchResult {
  displayName: string;
  lat: number;
  lng: number;
}

export interface Venue {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  address?: string;
  rating?: number;
  user_ratings_total?: number;
  google_maps_uri?: string;
  open_now?: boolean;
  distance_from_midpoint_m?: number;
  price_level?: string;
}

export interface FriendRouteSummary {
  friend_id: string;
  duration_minutes: number;
  distance_km: number;
  estimated_auto_fare_inr: number;
  estimated_cab_fare_inr: number;
  route_geojson: GeoJSON.Feature<GeoJSON.LineString>;
}

export interface RerouteResponse {
  destination: {
    lat: number;
    lng: number;
  };
  routes: FriendRouteSummary[];
}

export interface FairSpotResponse {
  fair_point: {
    lat: number;
    lng: number;
  };
  isochrone_geojson?: GeoJSON.FeatureCollection;
  routes: FriendRouteSummary[];
  venues: Venue[];
}
