import logging

import fiona
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.strtree import STRtree

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)

CROSSES_WATER = (
    "Bruecke",
    "Bruecke mit Treppe",
    "Bruecke mit Galerie",
    "Gedeckte Bruecke",
    "Steg",
    "Furt",
)
"""Structures (KUNSTBAUTE of TLM_STRASSE) that cross a river; they are named after it, e.g. "Bruecke (Linth)"."""

MIN_CROSSING_DISTANCE = 5
"""Crossings of the same bridge closer than this [in meters] are one crossing."""


def bridge_points(bridge: LineString, rivers: list) -> list:
    """
    Where to put the bridge into the index: at each crossing with a river (rivers: [(LineString, name)]), named
    after the river, or in the middle of the bridge if it crosses none.
    Returns [(x, y, river name or None)].
    """
    points = []
    for river, name in rivers:
        if not bridge.intersects(river):
            continue
        crossing = bridge.intersection(river)
        geoms = getattr(crossing, "geoms", [crossing])
        for g in geoms:
            if g.is_empty:
                continue
            p = g if isinstance(g, Point) else g.centroid
            if all(
                p.distance(Point(x, y)) >= MIN_CROSSING_DISTANCE for x, y, _ in points
            ):
                points.append((p.x, p.y, name or None))
    if not points:
        middle = bridge.interpolate(0.5, normalized=True)
        points.append((middle.x, middle.y, None))
    return points


def bridge_name(kunstbaute: str, river: str | None) -> str:
    return f"{kunstbaute} ({river})" if river else kunstbaute


class Bridges(IndexBuilder):
    """
    Inserts one point per bridge, underpass, tunnel, ford, ... of TLM_STRASSE: where a bridge crosses a river, at
    the crossing and named after the river ("Bruecke (Linth)"), otherwise in the middle of the structure.

    (Before, every vertex of such a street segment was inserted as "Bruecke (Wanderweg)": the points were at the
    ends of a bridge, e.g. on the river bank, and named after the hiking trail category.)
    """

    def load(self):
        bridges = []  # (LineString, kunstbaute, h)
        with fiona.open(self.base_path + "swissTLM3D_TLM_STRASSE.shp") as src:
            for obj in src:
                kunstbaute = obj["properties"]["KUNSTBAUTE"]
                if (
                    kunstbaute in ("Keine", "k_W")
                    or obj["geometry"]["type"] != "LineString"
                ):
                    continue
                coords = obj["geometry"]["coordinates"]
                h = sum(c[2] for c in coords) / len(coords) if len(coords[0]) > 2 else 0
                line = LineString([c[:2] for c in coords])
                if line.length > 0:
                    bridges.append((line, kunstbaute, h))
        logger.info("%d bridges, underpasses, ... found", len(bridges))

        # rivers crossed by each bridge, in one pass over the (large) river file
        crossing_rivers = [[] for _ in bridges]
        water = [i for i, (_, k, _) in enumerate(bridges) if k in CROSSES_WATER]
        tree = STRtree([bridges[i][0] for i in water])
        index_of = {id(bridges[i][0]): i for i in water}
        with fiona.open(self.base_path + "swissTLM3D_TLM_FLIESSGEWAESSER.shp") as src:
            for obj in src:
                geo = shape(obj["geometry"])
                if not isinstance(geo, (LineString, MultiLineString)):
                    continue
                geo = (
                    LineString([c[:2] for c in geo.coords])
                    if isinstance(geo, LineString)
                    else geo
                )
                name = obj["properties"].get("NAME") or None
                for candidate in tree.query(geo):
                    crossing_rivers[index_of[id(candidate)]].append((geo, name))

        for (line, kunstbaute, h), rivers in zip(bridges, crossing_rivers):
            for x, y, river in bridge_points(line, rivers):
                swiss_name = SwissName(
                    name=bridge_name(kunstbaute, river),
                    object_type=kunstbaute,
                    x=int(x),
                    y=int(y),
                    h=int(h),
                )
                self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)
