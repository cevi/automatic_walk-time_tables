"""Client for the awt-swiss-tml-api (names and objects of the swissTLM3D / swissNAMES3D index)."""

from __future__ import annotations

import os
from typing import List

import requests

SWISS_TLM_API_URL = os.environ.get(
    "SWISS_TLM_API_URL", "http://awt-swiss-tml-api:1848"
).rstrip("/")

MAX_NAME_OFFSET = 250
"""
A name is only used if the named object is at most this far [in meters] from the requested point. The naming service
limits each kind of object to its own radius (huts and passes 200 m, see swiss_TLM_api name_ranking) and returns no
name if nothing is within 100 m; this is the largest of those radii.
"""


def fetch_names(coords: List[List[float]], timeout: float = 60) -> List[dict]:
    """
    Names for LV95 coordinates [[e, n], ...], in the same order.
    Each entry is {"name", "object_type", "offset", "alternatives"}; name is "" if nothing is within MAX_NAME_OFFSET,
    alternatives are the next best names.
    """
    if not coords:
        return []
    resp = requests.post(
        SWISS_TLM_API_URL + "/names",
        json={"points": [[float(e), float(n)] for e, n in coords]},
        timeout=timeout,
    )
    resp.raise_for_status()
    result = []
    for r in resp.json()["names"]:
        close = r["offset"] <= MAX_NAME_OFFSET and r["swiss_name"]
        result.append(
            {
                "name": r["swiss_name"] if close else "",
                "object_type": r["object_type"] if close else "",
                "offset": r["offset"],
                # next best names, for a second place of a route that would get the same name
                "alternatives": [
                    a["swiss_name"]
                    for a in r.get("alternatives", [])
                    if a["swiss_name"] and a["offset"] <= MAX_NAME_OFFSET
                ],
            }
        )
    return result


def fetch_features_along_route(
    coords: List[List[float]], corridor: float = 25, timeout: float = 60
) -> List[dict]:
    """All objects of the index within `corridor` meters of the route [[e, n], ...]."""
    if not coords:
        return []
    resp = requests.post(
        SWISS_TLM_API_URL + "/features_along_route",
        json={"route": [[float(e), float(n)] for e, n in coords], "corridor": corridor},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()["features"]
