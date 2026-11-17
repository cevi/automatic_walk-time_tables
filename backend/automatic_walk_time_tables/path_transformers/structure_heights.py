"""
Heights on bridges and in tunnels.

The elevation model gives the terrain: under a high bridge the bottom of the gorge, above a tunnel the mountain.
A route over a bridge thus shows a dip in its elevation profile, a route through a tunnel a hump, and the walk
times count a descent and ascent that do not exist. swissTLM3D knows the height of the structure itself (the deck
of the bridge, the floor of the tunnel); where it differs from the profile, the profile is replaced by a straight
line between the points where the terrain meets the structure (the ends of the bridge, the portals of the tunnel).
"""

from __future__ import annotations

import logging
from typing import List, Tuple

import numpy as np
import requests

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils import swiss_tlm_api
from automatic_walk_time_tables.utils.path import Path

logger = logging.getLogger(__name__)

BRIDGES = {"Bruecke", "Bruecke mit Treppe", "Steg"}
"""The structure is above the terrain."""
TUNNELS = {"Tunnel", "Galerie", "Unterfuehrung", "Unterfuehrung mit Treppe"}
"""The structure is below the terrain."""

CORRIDOR = 15
"""A structure must be at most this far from the route [in meters], i.e. the route uses it."""
MIN_DIFFERENCE = 5
"""Profile and structure must differ by more than this at the structure [in meters] to correct anything."""
TOLERANCE = 3
"""The ends of a structure are where the profile comes within this of the structure's height [in meters]."""
MAX_HALF_LENGTH = 300
"""The ends must be at most this far from the structure's point [in meters], otherwise nothing is corrected."""


def correct_heights(
    dist: np.ndarray, heights: np.ndarray, structures: List[Tuple[int, bool, float]]
) -> np.ndarray:
    """
    structures: (index of the route point at the structure, True for a bridge / False for a tunnel, height of the
    structure). Returns the corrected heights.
    """
    h = heights.astype(float).copy()
    for k, is_bridge, level in structures:
        # bridge: the profile dips below the deck; tunnel: the profile is above the tunnel
        off = (level - h[k]) if is_bridge else (h[k] - level)
        if off <= MIN_DIFFERENCE:
            continue

        def reaches(i):
            return h[i] >= level - TOLERANCE if is_bridge else h[i] <= level + TOLERANCE

        a = k
        while a > 0 and not reaches(a) and dist[k] - dist[a] <= MAX_HALF_LENGTH:
            a -= 1
        b = k
        while (
            b < len(h) - 1 and not reaches(b) and dist[b] - dist[k] <= MAX_HALF_LENGTH
        ):
            b += 1
        if not (reaches(a) and reaches(b)) or b - a < 2:
            continue  # the ends are not found close by: the data do not match, keep the profile

        line = h[a] + (h[b] - h[a]) * (dist[a : b + 1] - dist[a]) / (dist[b] - dist[a])
        h[a : b + 1] = line
    return h


class StructureHeightTransformer(PathTransformer):
    """Corrects the heights of a path on bridges and in tunnels (see module docstring)."""

    def transform(self, path_: Path) -> Path:
        pts = path_.way_points
        if len(pts) < 3:
            return path_
        coords = [[p.lat, p.lon] for p in (wp.point.to_LV95() for wp in pts)]
        try:
            features = swiss_tlm_api.fetch_features_along_route(coords, CORRIDOR)
        except requests.exceptions.RequestException as e:
            logger.error("Could not fetch bridges and tunnels: %s", e)
            return path_

        xy = np.array(coords)
        structures = []
        for f in features:
            kind = f.get("object_type")
            if kind not in BRIDGES and kind not in TUNNELS or not f.get("h"):
                continue
            d2 = (xy[:, 0] - f["e"]) ** 2 + (xy[:, 1] - f["n"]) ** 2
            structures.append((int(np.argmin(d2)), kind in BRIDGES, float(f["h"])))
        if not structures:
            return path_

        dist = np.array([wp.accumulated_distance for wp in pts], dtype=float)
        heights = np.array([wp.point.h for wp in pts], dtype=float)
        corrected = correct_heights(dist, heights, structures)
        changed = 0
        for wp, h_old, h_new in zip(pts, heights, corrected):
            if abs(h_new - h_old) > 0.5:
                wp.point.h = float(h_new)
                changed += 1
        logger.info(
            "Corrected the heights of %d points on bridges and in tunnels", changed
        )
        return path_
