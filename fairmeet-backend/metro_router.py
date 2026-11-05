import json
import math
from collections import defaultdict, deque
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel


class MetroInterchange(BaseModel):
    station: str
    from_line: str
    to_line: str


class MetroRoute(BaseModel):
    origin_station: str
    origin_walk_or_drive_km: float
    destination_station: str
    destination_walk_km: float
    total_metro_stations: int
    interchanges: List[MetroInterchange]
    stations_sequence: List[str]
    estimated_metro_time_min: int
    approx_metro_fare_inr: int


def _distance_km(first_lat: float, first_lng: float, second_lat: float, second_lng: float) -> float:
    radius = 6371.0
    lat1, lat2 = math.radians(first_lat), math.radians(second_lat)
    delta_lat = math.radians(second_lat - first_lat)
    delta_lng = math.radians(second_lng - first_lng)
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _load_stations() -> List[dict]:
    path = Path(__file__).resolve().parent / "data" / "metro.json"
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file)
    except (OSError, ValueError) as error:
        print(f"Metro data could not be loaded: {error}")
        return []


_STATIONS = _load_stations()
_STATION_BY_NAME = {station["name"]: station for station in _STATIONS if station.get("name")}
_LINES: Dict[str, List[str]] = defaultdict(list)
for station in _STATIONS:
    name = station.get("name")
    for line in station.get("details", {}).get("line", []):
        if name:
            _LINES[line].append(name)


def _nearest_station(lat: float, lng: float) -> Tuple[Optional[str], float]:
    nearest_name = None
    nearest_distance = float("inf")
    for station in _STATIONS:
        details = station.get("details", {})
        if not isinstance(details.get("latitude"), (int, float)) or not isinstance(details.get("longitude"), (int, float)):
            continue
        distance = _distance_km(lat, lng, details["latitude"], details["longitude"])
        if distance < nearest_distance:
            nearest_name = station["name"]
            nearest_distance = distance
    return nearest_name, nearest_distance


def _build_graph() -> Dict[str, List[Tuple[str, str]]]:
    graph: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
    for line, names in _LINES.items():
        # The source contains station coordinates but not line order. Connecting
        # each station to its two closest same-line stations gives a usable,
        # deterministic graph while preserving interchanges by station name.
        for name in names:
            station = _STATION_BY_NAME[name]
            details = station["details"]
            neighbours = sorted(
                (
                    (
                        _distance_km(
                            details["latitude"],
                            details["longitude"],
                            _STATION_BY_NAME[other]["details"]["latitude"],
                            _STATION_BY_NAME[other]["details"]["longitude"],
                        ),
                        other,
                    )
                    for other in names
                    if other != name
                ),
                key=lambda item: item[0],
            )[:2]
            for _, other in neighbours:
                if (other, line) not in graph[name]:
                    graph[name].append((other, line))
    return graph


_GRAPH = _build_graph()


def compute_metro_journey(
    orig_lat: float,
    orig_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> Optional[MetroRoute]:
    if not _STATION_BY_NAME:
        return None

    origin, origin_access_km = _nearest_station(orig_lat, orig_lng)
    destination, destination_access_km = _nearest_station(dest_lat, dest_lng)
    if not origin or not destination or origin_access_km > 8 or destination_access_km > 8:
        return None
    if origin == destination:
        return MetroRoute(
            origin_station=origin,
            origin_walk_or_drive_km=round(origin_access_km, 2),
            destination_station=destination,
            destination_walk_km=round(destination_access_km, 2),
            total_metro_stations=0,
            interchanges=[],
            stations_sequence=[origin],
            estimated_metro_time_min=round((origin_access_km + destination_access_km) * 12),
            approx_metro_fare_inr=10,
        )

    queue = deque([origin])
    previous: Dict[str, Tuple[Optional[str], Optional[str]]] = {origin: (None, None)}
    while queue:
        current = queue.popleft()
        if current == destination:
            break
        for neighbour, line in _GRAPH.get(current, []):
            if neighbour not in previous:
                previous[neighbour] = (current, line)
                queue.append(neighbour)

    if destination not in previous:
        return None

    sequence: List[str] = []
    lines: List[str] = []
    current: Optional[str] = destination
    while current is not None:
        sequence.append(current)
        parent, line = previous[current]
        if line:
            lines.append(line)
        current = parent
    sequence.reverse()
    lines.reverse()

    interchanges: List[MetroInterchange] = []
    for index in range(1, len(lines)):
        if lines[index] != lines[index - 1]:
            interchanges.append(MetroInterchange(
                station=sequence[index],
                from_line=lines[index - 1],
                to_line=lines[index],
            ))

    station_count = max(0, len(sequence) - 1)
    total_minutes = round(origin_access_km * 8 + destination_access_km * 8 + station_count * 2.5 + len(interchanges) * 7)
    fare = min(60, max(10, 10 + station_count // 4 * 10))
    return MetroRoute(
        origin_station=origin,
        origin_walk_or_drive_km=round(origin_access_km, 2),
        destination_station=destination,
        destination_walk_km=round(destination_access_km, 2),
        total_metro_stations=station_count,
        interchanges=interchanges,
        stations_sequence=sequence,
        estimated_metro_time_min=total_minutes,
        approx_metro_fare_inr=fare,
    )
