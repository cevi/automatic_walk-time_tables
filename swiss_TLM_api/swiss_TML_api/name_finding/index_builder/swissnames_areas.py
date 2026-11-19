import logging
import math

import fiona
from shapely.geometry import shape

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)

SWISSNAMES3D_PLY = "./resources/swissNAMES3D_data/swissNAMES3D_PLY.shp"

SMALL_LAKE_MAX_LENGTH = 400
"""
Lakes up to this length [in meters, the long side of the smallest enclosing rectangle] name the points on their shore,
e.g. Stadlersee (392 m) or Arnisee (277 m). Larger lakes would name many points of a route the same: Oberer Chatzensee
(500 m), Unterer Chatzensee (743 m), Zürichsee.
"""
SHORE_STEP = 20
"""Distance [in meters] between the shore points of a small lake in the index."""


class SwissNamesAreas(IndexBuilder):
    """
    Names of areas of swissNAMES3D (swissNAMES3D_PLY): settlements and lakes, which the other parts of the index do
    not have (the hamlets of swissTLM3D are points, villages and towns are areas).

    - Siedlung: the official name of every settlement at a point inside it ("Salgesch", "Banco", "Stadel b. Niederglatt").
      Named like a hamlet (Ort), but no landmark of the way point selection: the point is the middle of an area,
      nothing you see on the ground.
    - See: the shore of small lakes, a point every SHORE_STEP meters ("Stadlersee"); see name_ranking.SMALL_LAKE.

    Only official names: "Salgesch", not the usual "Salquenen" of the same village.
    """

    def load(self):
        villages = lakes = shore_points = 0
        with fiona.open(SWISSNAMES3D_PLY) as src:
            for obj in src:
                props = obj["properties"]
                kind = props.get("OBJEKTART")
                if kind not in ("Ort", "See") or props.get("STATUS") != "offiziell":
                    continue
                name = props.get("NAME")
                geom = shape(obj["geometry"])
                if not name or geom.is_empty:
                    continue
                polygons = (
                    list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
                )
                heights = [
                    c[2] for p in polygons for c in p.exterior.coords if len(c) > 2
                ]

                if kind == "Ort":
                    point = geom.centroid
                    if not geom.contains(point):
                        point = geom.representative_point()
                    h = round(sum(heights) / len(heights)) if heights else 0
                    self._insert(name, "Siedlung", point.x, point.y, h)
                    villages += 1
                    continue

                if _length(geom) > SMALL_LAKE_MAX_LENGTH:
                    continue
                h = round(min(heights)) if heights else 0  # the water level
                for polygon in polygons:
                    ring = polygon.exterior
                    steps = max(4, int(ring.length // SHORE_STEP))
                    for i in range(steps):
                        p = ring.interpolate(i * ring.length / steps)
                        self._insert(name, "See", p.x, p.y, h)
                        shore_points += 1
                lakes += 1
        logger.info(
            "\tAdded %s settlements and %s small lakes (%s shore points) of swissNAMES3D_PLY",
            villages,
            lakes,
            shore_points,
        )

    def _insert(self, name, object_type, x, y, h):
        swiss_name = SwissName(
            name=name, object_type=object_type, x=int(x), y=int(y), h=int(h)
        )
        self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)


def _length(geom) -> float:
    """The long side of the smallest rectangle around geom [in meters]."""
    corners = list(geom.minimum_rotated_rectangle.exterior.coords)
    return max(math.dist(corners[i], corners[i + 1]) for i in range(2))
