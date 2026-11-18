from __future__ import annotations

import math
from typing import Callable

DEFAULT_CORRIDOR = 25
MAX_CORRIDOR = 100
SEGMENTS_PER_QUERY = 20
"""Route segments (about 10 m each) that share one query of the index."""


def _distance_to_segment(e0, n0, e1, n1, e, n) -> float:
    de, dn = e1 - e0, n1 - n0
    l2 = de * de + dn * dn
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((e - e0) * de + (n - n0) * dn) / l2))
    return math.hypot(e - (e0 + t * de), n - (n0 + t * dn))


def features_along_route(
    route: list, query_bbox: Callable, corridor: float = DEFAULT_CORRIDOR
) -> list:
    """
    All objects of the name index within `corridor` meters of the route (a list of LV95 [e, n] coordinates).

    query_bbox(e_min, n_min, e_max, n_max) returns the index objects within a bounding box.
    Each object is returned once, as {"name", "object_type", "e", "n", "h", "offset"};
    offset is its distance to the route in meters.
    """

    corridor = min(max(float(corridor), 0.0), MAX_CORRIDOR)
    route = [(float(e), float(n)) for e, n in route]
    if not route:
        return []
    segments = list(zip(route, route[1:])) or [(route[0], route[0])]

    found = {}  # key -> (offset, object)
    # one index query per chunk of segments: a query per segment would query the same objects again and again
    for c in range(0, len(segments), SEGMENTS_PER_QUERY):
        chunk = [
            (
                e0,
                n0,
                e1,
                n1,
                min(e0, e1) - corridor,
                min(n0, n1) - corridor,
                max(e0, e1) + corridor,
                max(n0, n1) + corridor,
            )
            for (e0, n0), (e1, n1) in segments[c : c + SEGMENTS_PER_QUERY]
        ]
        bbox = (
            min(s[4] for s in chunk),
            min(s[5] for s in chunk),
            max(s[6] for s in chunk),
            max(s[7] for s in chunk),
        )
        for obj in query_bbox(*bbox):
            offsets = [
                _distance_to_segment(e0, n0, e1, n1, obj.x, obj.y)
                for e0, n0, e1, n1, b0, b1, b2, b3 in chunk
                if b0 <= obj.x <= b2 and b1 <= obj.y <= b3
            ]
            if not offsets or min(offsets) > corridor:
                continue
            offset = min(offsets)
            key = (obj.name, obj.object_type, obj.x, obj.y)
            if key not in found or offset < found[key][0]:
                found[key] = (offset, obj)

    return [
        {
            "name": obj.name,
            "object_type": obj.object_type,
            "e": obj.x,
            "n": obj.y,
            "h": obj.h,
            "offset": round(offset, 1),
        }
        for offset, obj in found.values()
    ]
