"""
Landmarks: places along a route that make good waypoints for a walk-time table.

A good waypoint can be recognised when walking past it (a junction, a bridge, a summit, a stop, ...) and/or is
printed on the 1:25'000 map (a spot height). Field names, path ends and the like are never landmarks.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List

import numpy as np

from automatic_walk_time_tables.utils.path import Path

WEIGHTS = {
    # recognisable in the terrain (and usually printed on the map)
    "Hauptgipfel": 100,
    "Gipfel": 100,
    "Pass": 100,
    "Strassenpass": 100,
    "Gipfelkreuz": 95,
    "Haupthuegel": 95,
    "Huegel": 90,
    "Haltestelle Bahn": 90,
    "Haltestelle Schiff": 90,
    "Haltestelle Bus": 85,
    "Staudamm": 85,
    "Staumauer": 85,
    "Uebrige Bahnen": 80,
    "Kirche": 80,
    "Kapelle": 75,
    "Turm": 70,
    "Triangulationspyramide": 65,
    "Bildstock": 60,
    "Bruecke": 80,
    "Bruecke mit Treppe": 75,
    "Steg": 80,
    "Furt": 80,
    "Kreuzung": 80,
    "Kreisel": 80,
    "Weggabelung": 60,
    "Unterfuehrung": 65,
    "Unterfuehrung mit Treppe": 60,
    "Tunnel": 65,
    "Galerie": 60,
    "Ort": 75,
    "Quartierteil": 60,
    # printed on the map
    "Kotierter Punkt": 70,
    # weak: a stream crossing without a bridge is often a culvert you do not notice, a forest edge is vague
    "Fliessgewaesser": 55,
    "Waldrand": 35,
}
JUNCTIONS = {"Kreuzung", "Kreisel", "Weggabelung"}
STRONG = 60
"""Two features of at least this weight at the same place make a combined landmark (e.g. a fork with a spot height)."""

MAX_OFFSET = 20
"""A feature must be at most this far from the route [in meters]."""
CLUSTER_DISTANCE = 10
"""Features closer than this along the route [in meters] form one landmark."""
TURN_ANGLE = 45
"""A junction where the route turns by at least this angle [deg] is a decision point."""
TURN_BONUS = 15
COMBO_BONUS = 20


@dataclass
class Landmark:
    score: float
    feature: tuple  # LV95 (e, n) of the feature that is named
    types: List[str] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)

    def to_json(self):
        return {"score": self.score, "types": self.types, "reasons": self.reasons}


def _coords(path: Path):
    pts = [wp.point.to_LV95() for wp in path.way_points]
    xy = np.array([[p.lat, p.lon] for p in pts], dtype=float)
    dist = np.array([wp.accumulated_distance for wp in path.way_points], dtype=float)
    return xy, dist


def _turn_angle(xy, dist, i, window=30.0) -> float:
    a = int(np.searchsorted(dist, dist[i] - window))
    b = min(len(dist) - 1, int(np.searchsorted(dist, dist[i] + window)))
    if a >= i or b <= i:
        return 0.0
    h1 = math.atan2(xy[i][1] - xy[a][1], xy[i][0] - xy[a][0])
    h2 = math.atan2(xy[b][1] - xy[i][1], xy[b][0] - xy[i][0])
    return abs((math.degrees(h2 - h1) + 180) % 360 - 180)


def mark_landmarks(path: Path, features: List[dict], max_offset=MAX_OFFSET) -> int:
    """
    Attaches a Landmark to the way points of the path at which landmarks lie (way_point.landmark).

    features are objects of the name index along the route ({"name", "object_type", "e", "n", "offset"}),
    as returned by swiss_tlm_api.fetch_features_along_route. Returns the number of marked way points.
    """

    for wp in path.way_points:
        wp.landmark = None
    if path.number_of_waypoints == 0:
        return 0

    xy, dist = _coords(path)

    # every feature is attached to the nearest point of the path
    hits = []  # (index, weight, feature)
    for f in features:
        weight = WEIGHTS.get(f.get("object_type"))
        if weight is None or f.get("offset", 0) > max_offset:
            continue
        d2 = (xy[:, 0] - f["e"]) ** 2 + (xy[:, 1] - f["n"]) ** 2
        i = int(np.argmin(d2))
        if math.sqrt(d2[i]) <= max_offset + 10:  # route points are up to 10 m apart
            hits.append((i, weight, f))
    hits.sort(key=lambda h: dist[h[0]])

    # features at the same place form one landmark, placed at its strongest feature
    groups = []
    for h in hits:
        if groups and dist[h[0]] - dist[groups[-1][-1][0]] <= CLUSTER_DISTANCE:
            groups[-1].append(h)
        else:
            groups.append([h])

    for g in groups:
        i, weight, best = max(g, key=lambda h: h[1])
        types = sorted({h[2]["object_type"] for h in g})
        strong = {h[2]["object_type"] for h in g if h[1] >= STRONG}
        score, reasons = float(weight), [best["object_type"]]
        if len(strong) >= 2:
            score += COMBO_BONUS
            reasons.append("several landmarks")
        if strong & JUNCTIONS and _turn_angle(xy, dist, i) >= TURN_ANGLE:
            score += TURN_BONUS
            reasons.append("route turns")
        path.way_points[i].landmark = Landmark(
            score=score, feature=(best["e"], best["n"]), types=types, reasons=reasons
        )

    return len(groups)
