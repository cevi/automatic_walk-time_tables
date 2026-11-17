"""
Way points of a walk-time table, for the two modes of the frontend:

- automatic: select_waypoints() picks the way points for a route,
- manual: place_waypoints() puts way points chosen by the user onto the route (optionally onto a landmark nearby).

Both return named way points.
"""

from __future__ import annotations

import logging
from typing import List, Optional

import requests

from automatic_walk_time_tables.path_transformers.douglas_peucker_transformer import (
    DouglasPeuckerTransformer,
)
from automatic_walk_time_tables.path_transformers.landmarks import mark_landmarks
from automatic_walk_time_tables.path_transformers.naming_transformer import (
    NamingTransformer,
)
from automatic_walk_time_tables.path_transformers.pois_transfomer import POIsTransformer
from automatic_walk_time_tables.utils import swiss_tlm_api
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)

MAX_WAYPOINTS = 21
LANDMARK_BONUS = 20
"""See DouglasPeuckerTransformer: a landmark counts as deviating up to 20 m more from the secant."""
MAX_GAP = 1500
"""A walk-time table should have a way point at least every 1.5 km."""
MIN_GAP = 200
"""Way points closer than 200 m (with little height difference) are not worth a row in the table."""
LANDMARK_CORRIDOR = 25
SNAP_PENALTY_PER_M = 0.2
"""When snapping a manual way point, a landmark loses this much score per meter it is away."""


def _mark_landmarks(path: Path) -> int:
    coords = [[p.lat, p.lon] for p in (wp.point.to_LV95() for wp in path.way_points)]
    try:
        features = swiss_tlm_api.fetch_features_along_route(coords, LANDMARK_CORRIDOR)
    except requests.exceptions.RequestException as e:
        logger.error("Could not fetch landmarks, selecting without them: %s", e)
        features = []
    return mark_landmarks(path, features)


def select_waypoints(path: Path, fixed_distances: Optional[List[float]] = None) -> Path:
    """
    Automatic mode: selects up to MAX_WAYPOINTS way points that represent the elevation profile, preferring
    landmarks (see landmarks.py) and leaving no stretch longer than MAX_GAP without a way point.

    fixed_distances: accumulated distances [in meters] of way points that must be kept (start, end, highest and
    lowest point are always included).
    """

    n = _mark_landmarks(path)
    logger.info("%d landmarks along the route", n)

    pois = POIsTransformer(
        pois_distance_str=",".join(str(d) for d in fixed_distances or [])
    ).transform(path)
    selected = DouglasPeuckerTransformer(
        pois=pois,
        number_of_waypoints=MAX_WAYPOINTS,
        landmark_bonus=LANDMARK_BONUS,
        max_gap=MAX_GAP,
        min_gap=MIN_GAP,
    ).transform(path)
    return NamingTransformer().transform(selected)


def _nearest_index(path: Path, request: dict) -> int:
    pts = path.way_points
    if request.get("accumulated_distance") is not None:
        d = float(request["accumulated_distance"])
        return min(range(len(pts)), key=lambda i: abs(pts[i].accumulated_distance - d))
    e, n = float(request["x"]), float(request["y"])

    def dist2(i):
        p = pts[i].point.to_LV95()
        return (p.lat - e) ** 2 + (p.lon - n) ** 2

    return min(range(len(pts)), key=dist2)


START_END_DISTANCE = 50
"""With include_start_end, start and end are added unless a way point is closer than this [in meters]."""


def place_waypoints(
    path: Path,
    requests_: List[dict],
    snap_radius: float = 0,
    include_start_end: bool = False,
) -> List[WayPoint]:
    """
    Manual mode: puts each requested way point ({"accumulated_distance": m} or {"x": e, "y": n} in LV95) onto the
    nearest point of the route. With snap_radius > 0, a way point is moved to the best landmark within that many
    meters along the route. Returns the named way points in the order of the requests.

    include_start_end: also return the start and the end of the route (first and last), unless a requested way
    point is already there, e.g. after the route was changed. Without requested way points, this returns the
    start, the highest and lowest point and the end.
    """

    if path.number_of_waypoints == 0:
        return []
    # also without snapping: a way point at a landmark is named after it, as in the automatic mode
    _mark_landmarks(path)

    pts = path.way_points
    indices = [_nearest_index(path, req) for req in requests_]
    if include_start_end and not indices:
        # nothing chosen yet: start, highest point, lowest point and end (as the POIsTransformer)
        pois = POIsTransformer().transform(path)
        indices = [
            _nearest_index(path, {"accumulated_distance": p.accumulated_distance})
            for p in pois.way_points
        ]
    elif include_start_end:
        dists = [pts[i].accumulated_distance for i in indices]
        if not any(d - pts[0].accumulated_distance < START_END_DISTANCE for d in dists):
            indices.insert(0, 0)
        if not any(
            pts[-1].accumulated_distance - d < START_END_DISTANCE for d in dists
        ):
            indices.append(len(pts) - 1)

    placed = []
    for i in indices:
        if snap_radius > 0:
            d = pts[i].accumulated_distance
            candidates = [
                p
                for p in pts
                if p.landmark is not None
                and abs(p.accumulated_distance - d) <= snap_radius
            ]
            if candidates:
                best = max(
                    candidates,
                    key=lambda p: p.landmark.score
                    - SNAP_PENALTY_PER_M * abs(p.accumulated_distance - d),
                )
                i = pts.index(best)
        # a copy, so a route point requested twice is returned twice
        wp = WayPoint(pts[i].accumulated_distance, pts[i].point)
        wp.landmark = pts[i].landmark
        placed.append(wp)

    # the user decides about duplicate names in manual mode, so no disambiguation here
    NamingTransformer(disambiguate=False).name_way_points(placed)
    return placed


def waypoint_to_json(wp: WayPoint) -> dict:
    p = wp.point.to_LV95()
    landmark = getattr(wp, "landmark", None)
    return {
        "x": p.lat,
        "y": p.lon,
        "h": wp.point.h,
        "accumulated_distance": wp.accumulated_distance,
        "name": wp.name,
        "name_type": getattr(wp, "name_type", ""),
        "landmark": landmark.to_json() if landmark is not None else None,
    }
