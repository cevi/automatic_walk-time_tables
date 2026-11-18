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
NAMED_HUT = Category(85, 60)
"""
A named building that is a hut ("Blattihütte", "Refuge de la Christine"): a landmark, but only close by, as there are
hundreds of small huts (huts known by their field or place name, e.g. SAC huts, are HUT with 200 m).
"""
INN = Category(75, 40)
"""
Named remote inns, mountain hotels and shelters of swissNAMES3D ("Gasthof abgelegen", "Schutzhuette"): there are
thousands, from SAC huts to grottos, so they name a point only if they are right there; huts recognised by their
name ("...hütte", "SAC") are HUT.
"""
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
# Bridges, footbridges, fords, underpasses: visible on the ground, but the index has no name for them ("Bruecke"),
# so a junction at the same point (which carries street or field names) is the better name.
CROSSING = Category(9, 20)
NAMED_CROSSING = Category(30, 20)
"""A bridge named after the river it crosses ("Bruecke (Linth)") is a better name than a junction at the point."""
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
    # named buildings of swissNAMES3D (index_builder/named_buildings.py), the type is the use of the building
    "Gasthof abgelegen": INN,
    "Schutzhuette": INN,
    "Gebaeude": INN,  # named building without a recorded use, e.g. "Blattihütte"
    "Aussichtsturm": BUILDING,
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
    "Bruecke": CROSSING,
    "Bruecke mit Treppe": CROSSING,
    "Steg": CROSSING,
    "Furt": CROSSING,
    "Unterfuehrung": CROSSING,
    "Unterfuehrung mit Treppe": CROSSING,
    "Tunnel": CROSSING,
    "Galerie": CROSSING,
    "Fliessgewaesser": LINE_CROSSING,
    "Bisse Suone": LINE_CROSSING,
    "Sportplatz": SPORT,
    "Rodelbahn": SPORT,
    "Skisprungschanze": SPORT,
}

# Keywords are only looked up in names of objects that carry a name of their own.
KEYWORD_NAME_TYPES = (FIELD_NAME, PLACE, HILL, DISTRICT, DEFAULT)

_CLUB_HUT = re.compile(r"\b(SAC|CAS|CAI|DAV)\b")
"""A field or place name of a club hut ("Fründenhütte SAC"); matched on the original name, as only the capitals mark
the club. A plain "hütte" in a field name is mostly a farm, an alp or a former works ("Ziegelhütte", "Hüttenboden")."""
_NAMED_HUT = re.compile(
    r"(?<!c)hütt(e|en|a|li)\b|hitta|(?<![cs])hitt[eu]\b|biwak|\bbivouac\b|\bbivacco\b|\bcabane\b|\brefuge\b"
    r"|\bcapanna\b|\brifugio\b|\bcham[ao]nna\b|\bchamona\b|\bcamona\b|\bchamannin\b|\bunterkunft\b|\bsac\b|\bcas\b"
)
"""
A named building that is a mountain hut, in any of the languages. The hut word must end a word ("Blattihütte",
"Niwi Hitta", "Fusshornbiwak"), so "Restaurant Hüttenberg" or "Sennhüttenstübli" are no huts.
"""
_NOT_A_HUT = re.compile(r"(ziegel|glas|chol|kohl)hütten?\b")
"""Former brick, glass and charcoal works."""
GENERIC_HUT_NAMES = {
    "waldhütte",
    "forsthütte",
    "jagdhütte",
    "schutzhütte",
    "skihütte",
    "hütten",
    "hüttli",
    "hütta",
    "hitta",
    "refuge",
    "le refuge",
    "refuge forestier",
    "cabane",
    "la cabane",
    "cabane forestière",
    "capanna",
    "rifugio",
    "baita",
    "biwak",
    "bivacco",
    "bivouac",
    "chamanna",
    "chamonna",
}
"""
Names that are just a kind of hut, e.g. the 65 buildings called "Refuge" (mostly forest shelters in the Jura): there
are many of each, so they name a point only right next to it (BUILDING) and are no landmark.
"""
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

    if category is INN and _NAMED_HUT.search(name_lower):
        if name_lower in GENERIC_HUT_NAMES:
            return BUILDING
        if not _NOT_A_HUT.search(name_lower):
            # a staffed hut (remote inn, e.g. an SAC hut) is a landmark from afar, other huts only close by
            return (
                HUT
                if object_type in ("Gasthof abgelegen", "Schutzhuette")
                else NAMED_HUT
            )
    if category is CROSSING and "(" in name_lower and "wanderweg)" not in name_lower:
        return NAMED_CROSSING

    if category in KEYWORD_NAME_TYPES:
        if _CLUB_HUT.search(name or ""):
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
