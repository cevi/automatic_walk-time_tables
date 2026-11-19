from __future__ import annotations

import logging
import math
from typing import Iterable

from swiss_TML_api.name_finding.name_ranking import AT_POINT_RADIUS, classify, rank

logger = logging.getLogger(__name__)

IGNORED_TYPES = (
    "Trockenrinne",
    "Druckleitung einfach",
    "Druckleitung mehrfach",
    "Druckstollen",
)
"""Objects that are never used as a name (dry gullies and pressure pipelines)."""

PRETTY_PREFIXES = {
    "Bruecke": "Brücke",
    "Gedeckte Bruecke": "Gedeckte Brücke",
    "Unterfuehrung": "Unterführung",
}
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
    # an object with names in several languages: the index joins them, the official name first
    # ("Passo del San Gottardo | Gotthardpass | Col du St-Gothard"); a bridge lists its river's names in brackets
    head, bracket, rest = name.partition(" (")
    if " | " in head:
        name = head.split(" | ")[0] + bracket + rest
    # rivers with several names: "Brücke (Escherkanal | Linth)" -> "Brücke (Escherkanal/Linth)", but only the
    # first of a list of translations: "Brücke (Rhein | Le Rhin | Rein | Reno)" -> "Brücke (Rhein)"
    if name.endswith(")") and " (" in name and " | " in name:
        head, inner = name[:-1].split(" (", 1)
        parts = [p.strip() for p in inner.split(" | ")]
        inner = "/".join(parts) if len(parts) <= 2 else parts[0]
        name = f"{head} ({inner})"
    return name


def _translations(candidates: list) -> set:
    """
    The other names of objects with names in several languages. swissNAMES3D has a row per name (official, usual
    and foreign, e.g. "Matterhorn", "Mont Cervin", "Monte Cervino"), and the index also has the joined name with the
    official one first ("Matterhorn | Mont Cervin | Monte Cervino"). Returns (type, x, y, name) of the other names.
    """
    result = set()
    for c in candidates:
        head = (c.name or "").partition(" (")[0]
        if " | " in head:
            for other in head.split(" | ")[1:]:
                result.add((c.object_type, round(c.x), round(c.y), other))
    return result


PLACE_TYPES = ("Ort", "Ortsteil", "Siedlung")
"""Hamlets and parts of villages ("Lettenhof"): printed on the map like field names."""


def _is_local_name(obj) -> bool:
    """A field name ("Oberer Lätten") or the name of a hamlet ("Lettenhof"): what the map prints next to a point."""
    t = obj.object_type or ""
    return "flurname" in t.lower() or "lokalname" in t.lower() or t in PLACE_TYPES


SPOT_HEIGHT_PLACE_RADIUS = 250
"""A spot height is completed with the nearest place or field name within this distance [in meters]."""

STREET_FORK_FIELD_NAME_RADIUS = 100
"""
A fork named after a single street ("Weggabelung Letziweg") is renamed after the nearest field or place name within
this distance [in meters] ("Weggabelung bei Ob der Hueb", "Weggabelung bei Lettenhof"). Street names are not printed
on the 1:25'000 map and repeat along the whole street, field and place names are and do not.
"""


MAX_FALLBACK_DISTANCE = 100
"""Without a candidate within its radius, the nearest named object is used only up to this distance [in meters]."""


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


MAX_ALTERNATIVES = 4
"""Number of other names returned with a name, best first (see find_name)."""


def find_name(candidates: list, e: float, n: float) -> dict:
    """
    Chooses the name for the LV95 coordinate (e, n) among the candidates of the name index (sorted by distance).

    Returns {"lv95_coord", "offset", "swiss_name", "object_type", "alternatives"}; offset is the distance in meters
    between the requested coordinate and the named object. alternatives are the next best names
    ([{"swiss_name", "object_type", "offset"}, ...], other names only): a walk-time table uses one of them for a
    second place that would get the same name.
    """

    translations = _translations(candidates)
    ranked = []
    for c in candidates:
        if c.object_type in IGNORED_TYPES:
            continue
        if (c.object_type, round(c.x), round(c.y), c.name) in translations:
            continue  # "Mont Cervin" next to "Matterhorn | Mont Cervin | Monte Cervino": not the official name
        if c.name and "fliessgewaesser (keine brücke)" in c.name.lower():
            c.name = c.name.replace("Fliessgewaesser (Keine Brücke)", "Gewässerquerung")
        if not c.name or not str(c.name).strip():
            continue

        category = classify(c.name, c.object_type)
        dist = round(_dist(e, n, c))
        if dist <= category.max_distance:
            ranked.append((rank(category, dist), c))
    ranked.sort(key=lambda rc: rc[0], reverse=True)
    best = [c for _, c in ranked]

    if not best:
        # nothing within its radius: fall back to the nearest object that has a name, if it is close enough
        best = [
            c
            for c in candidates
            if c.name
            and str(c.name).strip()
            and _dist(e, n, c) <= MAX_FALLBACK_DISTANCE
        ][:1]
        if not best:
            return {
                "lv95_coord": (e, n),
                "offset": 0,
                "swiss_name": "",
                "object_type": "",
                "alternatives": [],
            }

    names = []
    for c in best:
        c = _spot_height_at_bus_stop(c, candidates, e, n) or c
        name = _final_name(c, candidates, e, n)
        if name and name not in (x[0] for x in names):
            names.append((name, c))
        if len(names) > MAX_ALTERNATIVES:
            break

    name, best_n = names[0]
    return {
        "lv95_coord": (best_n.x, best_n.y),
        "offset": round(_dist(e, n, best_n)),
        "swiss_name": name,
        "object_type": best_n.object_type,
        "alternatives": [
            {
                "swiss_name": nm,
                "object_type": c.object_type,
                "offset": round(_dist(e, n, c)),
            }
            for nm, c in names[1:]
        ],
    }


def _spot_height_at_bus_stop(obj, candidates: list, e: float, n: float):
    """
    A spot height printed at a bus stop: names of bus stops are not printed on the map ("Horgenberg, Nordecke"),
    the spot height is, so the point is named after it ("Punkt 620 (Hinter Horgenberg)").
    """
    if obj.object_type != "Haltestelle Bus":
        return None
    spot = _nearest(candidates, e, n, ("Kotierter Punkt",), AT_POINT_RADIUS)
    return spot if spot and spot.name and spot.name.startswith("Punkt ") else None


def _final_name(best_n, candidates: list, e: float, n: float) -> str:
    """The name of the coordinate (e, n) if it is named after best_n, completed with the objects around it."""
    name = pretty_name(best_n.name)
    others = [c for c in candidates if c is not best_n]

    if best_n.object_type == "Gipfelkreuz":
        peak = _nearest(others, e, n, ("Hauptgipfel", "Gipfel"), 250)
        if peak:
            name = f"Gipfelkreuz {peak.name}"

    if best_n.object_type == "Kotierter Punkt" or name.startswith("Punkt "):
        # a village or hamlet is printed larger than a field name: "Punkt 584 (Banco)", not "(I Vignòo)"
        place = _nearest(others, e, n, PLACE_TYPES, SPOT_HEIGHT_PLACE_RADIUS)
        field = place or _nearest(
            others, e, n, _is_local_name, SPOT_HEIGHT_PLACE_RADIUS
        )
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
                _is_local_name,
                STREET_FORK_FIELD_NAME_RADIUS,
            )
            if field:
                name = "Weggabelung bei " + field.name

    return name
