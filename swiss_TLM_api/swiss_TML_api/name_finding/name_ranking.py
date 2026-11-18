from __future__ import annotations

import re
from typing import NamedTuple

AT_POINT_RADIUS = 15
"""
An object within this distance [in meters] is considered to be "at the requested point"
and is preferred over anything that is merely nearby.
"""

LANDMARK_PRIORITY = 80
"""
Features with at least this priority (huts, passes, lakes, summits) win regardless of what is at the point.
"""


class Category(NamedTuple):
    priority: int
    max_distance: int  # in meters


DEFAULT = Category(0, 50)

HUT = Category(100, 200)
PASS = Category(90, 200)
LAKE = Category(85, 250)
SUMMIT = Category(80, 150)
DAM = Category(70, 100)
STOP = Category(70, 50)
SPOT_HEIGHT = Category(60, 10)
PLACE = Category(55, 100)
FIELD_NAME = Category(50, 120)
HILL = Category(50, 60)
BUILDING = Category(45, 10)
DISTRICT = Category(40, 60)
NATIONAL_PARK = Category(30, 50)
AREAL = Category(30, 30)
LINE_CROSSING = Category(20, 20)
SPORT = Category(15, 20)
JUNCTION = Category(10, 25)
FOREST_EDGE = Category(8, 15)
PATH_END = Category(5, 25)

# The names of these objects are derived from adjacent street names or field names, e.g. "Weggabelung Route du Lac"
# or "Weggabelung bei Wigerehütte". Keywords in such names say nothing about the object itself.
DERIVED_NAME_TYPES = {
    "Kreuzung": JUNCTION,
    "Weggabelung": JUNCTION,
    "Kreisel": JUNCTION,
    "Wegende": PATH_END,
    "Waldrand": FOREST_EDGE,
}

OBJECT_TYPES = {
    "Pass": PASS,
    "Strassenpass": PASS,
    "Hauptgipfel": SUMMIT,
    "Gipfel": SUMMIT,
    "Alpiner Gipfel": SUMMIT,
    "Gipfelkreuz": SUMMIT,
    "Staudamm": DAM,
    "Staumauer": DAM,
    "Staumauer, Wehr": DAM,
    "Wehr": DAM,
    "Haltestelle Bus": STOP,
    "Haltestelle Bahn": STOP,
    "Haltestelle Schiff": STOP,
    "Uebrige Bahnen": STOP,
    "Kotierter Punkt": SPOT_HEIGHT,
    "Ort": PLACE,
    "Ortsteil": PLACE,
    "Flurname swisstopo": FIELD_NAME,
    "Lokalname swisstopo": FIELD_NAME,
    "Haupthuegel": HILL,
    "Huegel": HILL,
    "Felskopf": HILL,
    "Aussichtspunkt": HILL,
    "Turm": BUILDING,
    "Kapelle": BUILDING,
    "Historische Baute": BUILDING,
    "in/auf Gebaeude": BUILDING,
    "Quartier": DISTRICT,
    "Quartierteil": DISTRICT,
    "Nationalparksgrenze": NATIONAL_PARK,
    "Fliessgewaesser": LINE_CROSSING,
    "Bisse Suone": LINE_CROSSING,
    "Sportplatz": SPORT,
    "Rodelbahn": SPORT,
    "Skisprungschanze": SPORT,
}

# Keywords are only looked up in names of objects that carry a name of their own.
KEYWORD_NAME_TYPES = (FIELD_NAME, PLACE, HILL, DISTRICT, DEFAULT)

_HUT = re.compile(r"hütte|\bsac\b|\bcas\b|abgelegener gasthof")
_LAKE = re.compile(r"\b(lac|lai|lago|lej) |see$|\bsee |\blac$|\blai$")


def is_lake(name: str | None, object_type: str | None) -> bool:
    return classify(name, object_type) is LAKE


def classify(name: str | None, object_type: str | None) -> Category:
    """
    Returns the category (priority and maximal distance) of an object of the name index.
    """

    name_lower = name.lower() if name else ""
    object_type = object_type or ""

    if object_type in DERIVED_NAME_TYPES:
        return DERIVED_NAME_TYPES[object_type]

    if name_lower.startswith(("kreuzung hochspannungsleitung", "kreuzung seilbahn")):
        return LINE_CROSSING

    if name_lower.startswith("punkt "):
        return SPOT_HEIGHT

    category = OBJECT_TYPES.get(object_type)
    if category is None:
        category = AREAL if object_type.endswith("areal") else DEFAULT

    if category in KEYWORD_NAME_TYPES:
        if _HUT.search(name_lower) or object_type.lower() == "abgelegener gasthof":
            return HUT
        if _LAKE.search(name_lower):
            return LAKE

    return category


def rank(category: Category, distance: float) -> tuple:
    """
    Sort key of a candidate within its maximal distance, bigger is better.

    Landmarks always win. Apart from that, an object which is at the requested point is preferred over
    everything that is merely nearby (e.g. a junction at 2 m beats a field name 80 m away).

    Stops are the exception: they name their surroundings (e.g. "Zürich, Kreuzplatz"),
    thus they compete with the objects at the point within their whole radius.
    """

    is_landmark = category.priority >= LANDMARK_PRIORITY
    is_at_point = category is STOP or (
        category.priority > PATH_END.priority and distance <= AT_POINT_RADIUS
    )
    return is_landmark, is_at_point, category.priority, -distance
