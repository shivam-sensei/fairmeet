import os
import httpx
import asyncio
import math
from typing import Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from shapely.geometry import shape, Point, mapping
from metro_router import MetroRoute, compute_metro_journey
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

HEIGIT_API_KEY = os.getenv("HEIGIT_API_KEY")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

app = FastAPI(title="FairMeet API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from localhost, Vercel, or custom domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LocationPoint(BaseModel):
    id: str
    label: Optional[str] = None
    lat: float
    lng: float

class FairSpotRequest(BaseModel):
    locations: List[LocationPoint]
    profile: Optional[str] = "driving-car"
    override_target: Optional[dict] = None
    category: Optional[str] = "veg"

class VenueFilterRequest(BaseModel):
    lat: float
    lng: float
    category: Optional[str] = "veg"
    radius: Optional[float] = 800.0

class Venue(BaseModel):
    id: str
    name: str
    category: str
    lat: float
    lng: float
    distanceMeters: Optional[int] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    google_maps_uri: Optional[str] = None
    open_now: Optional[bool] = None
    distance_from_midpoint_m: Optional[int] = None
    price_level: Optional[str] = None

class FriendRouteSummary(BaseModel):
    friend_id: str
    duration_minutes: float
    distance_km: float
    estimated_auto_fare_inr: int
    estimated_cab_fare_inr: int
    route_geojson: dict
    metro_journey: Optional[MetroRoute] = None

class RerouteRequest(BaseModel):
    origins: List[LocationPoint]
    destination: dict
    profile: Optional[str] = "driving-car"

class RerouteResponse(BaseModel):
    destination: dict
    routes: List[FriendRouteSummary]

class FairSpotResponse(BaseModel):
    fair_point: dict
    isochrone_geojson: Optional[dict] = None
    routes: List[FriendRouteSummary]
    venues: List[Venue]


async def fetch_single_route(
    client: httpx.AsyncClient,
    origin: LocationPoint,
    destination: dict,
    profile: str,
) -> Optional[FriendRouteSummary]:
    url = f"https://api.heigit.org/openrouteservice/v2/directions/{profile}/geojson"
    headers = {
        "Authorization": HEIGIT_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "coordinates": [
            [origin.lng, origin.lat],
            [destination["lng"], destination["lat"]],
        ],
        # Allow HeiGIT to snap open-field targets to the nearest routable road.
        "radiuses": [-1, -1],
    }
    try:
        response = await client.post(url, json=payload, headers=headers, timeout=8.0)
        if response.status_code != 200:
            print(f"HeiGIT route API error for {origin.id}: {response.text}")
            return None

        features = response.json().get("features", [])
        if not features:
            return None

        feature = features[0]
        summary = feature.get("properties", {}).get("summary", {})
        duration_minutes = round(summary.get("duration", 0) / 60.0, 1)
        distance_km = round(summary.get("distance", 0) / 1000.0, 1)
        auto_fare = int(round(30 + max(0.0, distance_km - 1.5) * 11))
        cab_fare = int(round(50 + distance_km * 14 + duration_minutes * 1.5))

        return FriendRouteSummary(
            friend_id=origin.id,
            duration_minutes=duration_minutes,
            distance_km=distance_km,
            estimated_auto_fare_inr=auto_fare,
            estimated_cab_fare_inr=cab_fare,
            route_geojson=feature,
            metro_journey=compute_metro_journey(
                orig_lat=origin.lat,
                orig_lng=origin.lng,
                dest_lat=destination["lat"],
                dest_lng=destination["lng"],
            ),
        )
    except Exception as error:
        print(f"Error routing friend {origin.id}: {error}")
        return None


async def fetch_isochrones(locations: List[LocationPoint], profile: str, ranges: List[int]) -> dict:
    url = f"https://api.heigit.org/openrouteservice/v2/isochrones/{profile}"
    headers = {
        "Authorization": HEIGIT_API_KEY,
        "Content-Type": "application/json"
    }
    # OpenRouteService expects coordinates as [longitude, latitude]
    coords = [[loc.lng, loc.lat] for loc in locations]
    payload = {
        "locations": coords,
        "range": ranges,
        "range_type": "time",
        "location_type": "destination"  # Travel TOWARDS the meetup spot
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code != 200:
            print(f"HeiGIT Isochrone API Error: {res.text}")
            return {}
        return res.json()


CATEGORY_TYPES = {
    "veg": ["vegetarian_restaurant", "cafe", "coffee_shop", "tea_house", "bakery", "snack_bar", "ice_cream_shop", "fast_food_restaurant"],
    "all": ["cafe", "coffee_shop", "tea_house", "bakery", "fast_food_restaurant", "snack_bar", "pizza_restaurant", "sandwich_shop", "ice_cream_shop", "restaurant"],
    "cafes": ["cafe", "coffee_shop", "tea_house", "bakery"],
    "quick_bites": ["fast_food_restaurant", "snack_bar", "pizza_restaurant", "sandwich_shop", "ice_cream_shop"],
    "dining": ["restaurant", "family_restaurant", "indian_restaurant"],
}


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    radius = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    value = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return int(radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value)))


async def _query_google_text_search(
    client: httpx.AsyncClient,
    query: str,
    lat: float,
    lng: float,
    radius: float = 1200.0,
) -> List[dict]:
    """Run one focused Google Places Text Search query."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.primaryTypeDisplayName,"
            "places.location,places.rating,places.userRatingCount,"
            "places.googleMapsUri,places.regularOpeningHours"
        ),
    }
    payload = {
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius,
            }
        },
        "rankPreference": "DISTANCE",
        "pageSize": 10,
    }
    try:
        response = await client.post(
            "https://places.googleapis.com/v1/places:searchText",
            json=payload,
            headers=headers,
            timeout=5.0,
        )
        if response.status_code == 200:
            return response.json().get("places", [])
        print(f"Places query '{query}' failed with HTTP {response.status_code}: {response.text}")
    except Exception as error:
        print(f"Places query '{query}' exception: {error!r}")
    return []


async def fetch_popular_food_spots(
    lat: float, lng: float, category: str = "all", radius: float = 1200.0
) -> List[Venue]:
    """Search the midpoint, expanding outward when it falls in a sparse area."""
    if not GOOGLE_PLACES_API_KEY:
        print("GOOGLE_PLACES_API_KEY missing, using fallbacks.")
        return get_fallback_venues(lat, lng)

    query_by_category = {
        "veg": ("vegetarian cafes and coffee", "vegetarian food and restaurants"),
        "cafes": ("cafes and coffee", "bakeries and tea houses"),
        "quick_bites": ("fast food and snacks", "pizza and sandwich shops"),
        "dining": ("casual restaurants", "Indian restaurants"),
        "all": ("cafes and coffee", "popular food and restaurants"),
    }
    cafe_query, food_query = query_by_category.get(
        category, query_by_category["all"]
    )
    # Keep the fair-point centroid fixed while expanding the commercial catchment.
    search_radii = [max(1500.0, radius), 2500.0, 4000.0]

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            for search_radius in search_radii:
                cafe_results, food_results = await asyncio.gather(
                    _query_google_text_search(
                        client, cafe_query, lat, lng, search_radius
                    ),
                    _query_google_text_search(
                        client, food_query, lat, lng, search_radius
                    ),
                )
                venues: List[Venue] = []
                seen_ids: set[str] = set()
                for place in [*cafe_results, *food_results]:
                    place_id = place.get("id")
                    name = place.get("displayName", {}).get("text")
                    location = place.get("location", {})
                    if not place_id or place_id in seen_ids or not name:
                        continue
                    if "latitude" not in location or "longitude" not in location:
                        continue
                    seen_ids.add(place_id)
                    venue_lat = location["latitude"]
                    venue_lng = location["longitude"]
                    distance = haversine_distance_m(lat, lng, venue_lat, venue_lng)
                    if distance > search_radius:
                        continue
                    opening_hours = place.get("regularOpeningHours", {})
                    venues.append(Venue(
                        id=place_id,
                        name=name,
                        category=place.get("primaryTypeDisplayName", {}).get("text", "Hangout"),
                        lat=venue_lat,
                        lng=venue_lng,
                        rating=place.get("rating"),
                        user_ratings_total=place.get("userRatingCount"),
                        google_maps_uri=place.get("googleMapsUri"),
                        open_now=opening_hours.get("openNow"),
                        distance_from_midpoint_m=distance,
                    ))

                venues.sort(key=lambda venue: venue.distance_from_midpoint_m or 9999)
                if venues:
                    print(
                        f"Found {len(venues)} food spots within {search_radius:.0f}m "
                        f"of ({lat:.4f}, {lng:.4f})"
                    )
                    return venues[:8]
                print(f"No venues within {search_radius:.0f}m; expanding search.")
    except Exception as error:
        print(f"Google Places request failed: {error!r}")

    return get_fallback_venues(lat, lng)


async def fetch_nearby_venues_google(
    lat: float, lng: float, category: str = "all", radius: float = 1200.0
) -> List[Venue]:
    """Compatibility wrapper for category-filtered venue refreshes."""
    return await fetch_popular_food_spots(lat, lng, category, radius)


@app.post("/api/v1/venues", response_model=List[Venue])
async def get_filtered_venues(payload: VenueFilterRequest):
    return await fetch_nearby_venues_google(
        payload.lat,
        payload.lng,
        payload.category or "veg",
        payload.radius or 800.0,
    )

@app.post("/api/v1/reroute", response_model=RerouteResponse)
async def reroute_to_venue(payload: RerouteRequest):
    """Recalculate routes to a selected venue without venues or isochrone requests."""
    try:
        destination = {
            "lat": float(payload.destination["lat"]),
            "lng": float(payload.destination["lng"]),
        }
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="A valid destination latitude and longitude are required.")

    if not payload.origins:
        raise HTTPException(status_code=400, detail="At least one origin is required.")
    if not HEIGIT_API_KEY:
        raise HTTPException(status_code=500, detail="HeiGIT API key missing.")

    async with httpx.AsyncClient(timeout=8.0) as client:
        route_results = await asyncio.gather(*(
            fetch_single_route(
                client,
                origin,
                destination,
                payload.profile or "driving-car",
            )
            for origin in payload.origins
        ))

    routes = [route for route in route_results if route is not None]
    if not routes:
        raise HTTPException(status_code=502, detail="Unable to calculate routes to this venue.")
    return RerouteResponse(destination=destination, routes=routes)


def get_fallback_venues(lat: float, lng: float) -> List[Venue]:
    """Keep venue cards and map pins available when Overpass is unavailable."""
    return [
        Venue(
            id="fallback-1",
            name="Central Plaza Cafe",
            category="Cafe",
            lat=lat + 0.003,
            lng=lng + 0.003,
        ),
        Venue(
            id="fallback-2",
            name="Metro Food Court",
            category="Restaurant",
            lat=lat - 0.003,
            lng=lng - 0.002,
        ),
        Venue(
            id="fallback-3",
            name="Corner Bakery",
            category="Cafe",
            lat=lat + 0.001,
            lng=lng - 0.002,
        ),
    ]


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.post("/api/v1/fair-spot", response_model=FairSpotResponse)
async def calculate_fair_spot(payload: FairSpotRequest):
    if len(payload.locations) < 2:
        raise HTTPException(status_code=400, detail="At least 2 friends are required.")

    if not HEIGIT_API_KEY:
        raise HTTPException(status_code=500, detail="HeiGIT API key missing.")

    # 1. Base Arithmetic Midpoint (Reliable spatial center)
    avg_lat = sum(loc.lat for loc in payload.locations) / len(payload.locations)
    avg_lng = sum(loc.lng for loc in payload.locations) / len(payload.locations)
    target_point = {"lat": avg_lat, "lng": avg_lng}

    geojson_export = None

    if payload.override_target:
        target_point = {
            "lat": payload.override_target["lat"],
            "lng": payload.override_target["lng"],
        }
    else:
        try:
        # Request a tighter 15-minute and 25-minute range
            ranges = [900, 1500]
            isochrone_data = await fetch_isochrones(payload.locations, payload.profile, ranges)
            features = isochrone_data.get("features", [])

            if features:
                # Group polygons by location index
                friend_polygons = {}
                for idx, feat in enumerate(features):
                    loc_idx = feat.get("properties", {}).get("location_index")
                    if loc_idx is None:
                        loc_idx = idx // len(ranges)

                    geom = shape(feat["geometry"])
                    if loc_idx not in friend_polygons or geom.area > friend_polygons[loc_idx].area:
                        friend_polygons[loc_idx] = geom

                poly_list = list(friend_polygons.values())

                if len(poly_list) >= 2:
                    common_area = poly_list[0]
                    for polygon in poly_list[1:]:
                        common_area = common_area.intersection(polygon)

                    if not common_area.is_empty:
                        # Anchor the fair point inside the common area closest to the center.
                        midpoint_geom = Point(avg_lng, avg_lat)
                        if common_area.contains(midpoint_geom):
                            target_point = {"lat": avg_lat, "lng": avg_lng}
                        else:
                            nearest_pt = common_area.boundary.interpolate(
                                common_area.boundary.project(midpoint_geom)
                            )
                            target_point = {"lat": nearest_pt.y, "lng": nearest_pt.x}

                        geojson_export = {
                            "type": "FeatureCollection",
                            "features": [{
                                "type": "Feature",
                                "geometry": mapping(common_area),
                                "properties": {"label": "Fair Meetup Zone"},
                            }],
                        }
        except Exception as error:
            print(f"Isochrone calculation fallback to center: {error}")

    # Fetch venues around the calculated point
    async with httpx.AsyncClient(timeout=15.0) as client:
        route_tasks = [
            fetch_single_route(client, loc, target_point, payload.profile or "driving-car")
            for loc in payload.locations
        ]
        routes = [route for route in await asyncio.gather(*route_tasks) if route is not None]
    venues = await fetch_popular_food_spots(
        target_point["lat"], target_point["lng"]
    )

    return FairSpotResponse(
        fair_point=target_point,
        isochrone_geojson=geojson_export,
        routes=routes,
        venues=venues
    )