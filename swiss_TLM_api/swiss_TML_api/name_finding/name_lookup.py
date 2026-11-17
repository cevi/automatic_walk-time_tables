from __future__ import annotations

import logging
import math
from typing import Iterable

from swiss_TML_api.name_finding.name_ranking import classify, is_lake, rank

logger = logging.getLogger(__name__)

IGNORED_TYPES = (
    "Trockenrinne",
    "Druckleitung einfach",
    "Druckleitung mehrfach",
    "Druckstollen",
)
"""Objects that are never used as a name (dry gullies and pressure pipelines)."""

PRETTY_PREFIXES = {"Bruecke": "Brücke", "Unterfuehrung": "Unterführung"}
"""Names of structures in the index start with the object type, written without umlauts."""

TRAIL_CATEGORIES = (" (Wanderweg)", " (Bergwanderweg)", " (Alpinwanderweg)")
"""Older indexes name bridges after the hiking trail category ("Bruecke (Wanderweg)"), which is no name."""


def pretty_name(name: str) -> str:
    """ "Bruecke (Linth)" -> "Brücke (Linth)", "Bruecke (Wanderweg)" -> "Brücke"."""
    for suffix in TRAIL_CATEGORIES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    for raw, pretty in PRETTY_PREFIXES.items():
        if name.startswith(raw):
            name = pretty + name[len(raw) :]
    # rivers with several names: "Brücke (Escherkanal | Linth)" -> "Brücke (Escherkanal/Linth)", but only the
    # first of a list of translations: "Brücke (Rhein | Le Rhin | Rein | Reno)" -> "Brücke (Rhein)"
    if name.endswith(")") and " (" in name and " | " in name:
        head, inner = name[:-1].split(" (", 1)
        parts = [p.strip() for p in inner.split(" | ")]
        inner = "/".join(parts) if len(parts) <= 2 else parts[0]
        name = f"{head} ({inner})"
    return name


def _is_field_name(obj) -> bool:
    t = (obj.object_type or "").lower()
    return "flurname" in t or "lokalname" in t


STREET_FORK_FIELD_NAME_RADIUS = 100
"""
A fork named after a single street ("Weggabelung Letziweg") is renamed after the nearest field name within this
distance [in meters] ("Weggabelung bei Ob der Hueb"). Street names are not printed on the 1:25'000 map and repeat
along the whole street, field names are and do not.
"""


def _dist(e: float, n: float, obj) -> float:
    return math.hypot(obj.x - e, obj.y - n)


def _nearest(candidates: Iterable, e: float, n: float, types, max_dist: float):
    """Nearest candidate within max_dist whose type is in `types` (a tuple) or satisfies `types` (a predicate)."""
    match = types if callable(types) else (lambda c: c.object_type in types)
    best, best_d = None, max_dist
    for c in candidates:
        if match(c):
            d = round(_dist(e, n, c))
            if d <= best_d:
                best, best_d = c, d
    return best


def find_name(candidates: list, e: float, n: float) -> dict:
    """
    Chooses the name for the LV95 coordinate (e, n) among the candidates of the name index (sorted by distance).

    Returns {"lv95_coord", "offset", "swiss_name", "object_type"}; offset is the distance in meters between the
    requested coordinate and the named object.
    """

    best_n, best_rank = None, None
    for c in candidates:
        if c.object_type in IGNORED_TYPES:
            continue
        if c.name and "fliessgewaesser (keine brücke)" in c.name.lower():
            c.name = c.name.replace("Fliessgewaesser (Keine Brücke)", "Gewässerquerung")

        category = classify(c.name, c.object_type)
        dist = round(_dist(e, n, c))
        if dist <= category.max_distance:
            r = rank(category, dist)
            if best_rank is None or r > best_rank:
                best_n, best_rank = c, r

    if best_n is None:
        # nothing within its radius: fall back to the nearest object that has a name
        named = [c for c in candidates if c.name and str(c.name).strip()]
        best_n = named[0] if named else candidates[0]

    name = pretty_name(best_n.name)
    others = [c for c in candidates if c is not best_n]

    if (
        is_lake(name, best_n.object_type)
        and f"({int(best_n.h)})" not in name
        and best_n.h > 0
    ):
        name = f"{name} ({int(best_n.h)})"

    if best_n.object_type == "Gipfelkreuz":
        peak = _nearest(others, e, n, ("Hauptgipfel", "Gipfel"), 250)
        if peak:
            name = f"Gipfelkreuz {peak.name}"

    if best_n.object_type == "Kotierter Punkt" or name.startswith("Punkt "):
        field = _nearest(others, e, n, _is_field_name, 250)
        if field:
            name = f"{name} ({field.name})"

    if best_n.object_type == "Weggabelung":
        summit = _nearest(others, e, n, ("Hauptgipfel",), 250)
        if summit:
            name = "Weggabelung bei " + summit.name
        elif name.startswith("Weggabelung ") and not name.startswith(
            "Weggabelung bei "
        ):
            field = _nearest(
                others,
                best_n.x,
                best_n.y,
                _is_field_name,
                STREET_FORK_FIELD_NAME_RADIUS,
            )
            if field:
                name = "Weggabelung bei " + field.name

    return {
        "lv95_coord": (best_n.x, best_n.y),
        "offset": round(_dist(e, n, best_n)),
        "swiss_name": name,
        "object_type": best_n.object_type,
    }
