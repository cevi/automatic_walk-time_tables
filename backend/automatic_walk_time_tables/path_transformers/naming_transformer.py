import math
import logging
from typing import List

import requests

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils import swiss_tlm_api
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)


SAME_PLACE_DISTANCE = 20
"""Way points with the same name at most this far apart [in meters] are the same place."""


def _anchor(name: str) -> str:
    """The place a name refers to: "Weggabelung bei Stigelos" -> "Stigelos" (an alternative must not repeat it)."""
    return name.split(" bei ", 1)[1] if " bei " in name else name


class NamingTransformer(PathTransformer):
    """
    Fetches the names for each point in the path (in one request to the awt-swiss-tml-api).

    A point at a landmark (way_point.landmark) is named after the landmark's own coordinate, so a fork that the
    point was snapped to is named as the fork. Names that occur more than once in the path get the height
    appended ("Weggabelung bei Nüberich (569)"), as two rows with the same name are ambiguous in a walk-time table.
    """

    def __init__(self, use_default_name: bool = False, disambiguate: bool = True):
        super().__init__()
        self.use_default_name = use_default_name
        self.disambiguate = disambiguate

    def transform(self, path_: Path) -> Path:
        self.name_way_points(path_.way_points)
        return path_

    def name_way_points(self, way_points: List[WayPoint]) -> None:
        coords = []
        for wp in way_points:
            landmark = getattr(wp, "landmark", None)
            if landmark is not None:
                coords.append(list(landmark.feature))
            else:
                lv95 = wp.point.to_LV95()
                coords.append([lv95.lat, lv95.lon])

        try:
            names = swiss_tlm_api.fetch_names(coords)
        except requests.exceptions.RequestException as e:
            # TODO: we skip connection errors (see https://github.com/cevi/automatic_walk-time_tables/issues/247)
            logger.error("Error while fetching names from awt-swiss-tml-api: %s", e)
            names = [
                {"name": "", "object_type": "", "offset": None, "alternatives": []}
            ] * len(coords)

        for wp, (e, n), r in zip(way_points, coords, names):
            wp.name = r["name"]
            wp.name_type = r["object_type"]
            wp.name_alternatives = list(r.get("alternatives") or [])
            landmark = getattr(wp, "landmark", None)
            spot_at_bus_stop = (
                landmark is not None
                and landmark.name_type == "Haltestelle Bus"
                and r["object_type"] == "Kotierter Punkt"
            )
            if landmark is not None and landmark.name and not spot_at_bus_stop:
                # (except a bus stop with a spot height: the naming service names it after the printed spot height)
                # a station, hut, summit, ... is named after itself, even if the naming service ranks
                # something else nearby higher (e.g. a hotel next to the cable car station)
                wp.name = landmark.name
                wp.name_type = landmark.name_type or ""
                wp.name_alternatives = [
                    a for a in [r["name"]] + wp.name_alternatives if a
                ]
            if not wp.name and self.use_default_name:
                wp.name = f"{round(e)}, {round(n)}"

        if self.disambiguate:
            self._disambiguate(way_points)

    @staticmethod
    def _disambiguate(way_points: List[WayPoint]):
        """
        A second, different place with the name of an earlier way point gets the next best name of the naming
        service that is not used yet, or else the height of the way point ("Weggabelung bei X (812)"). The same
        place passed twice (e.g. start and end of a loop) keeps its name, and so does a spot height ("Punkt 628"):
        its number already is a height.
        """
        seen = {}  # name -> LV95 points named so
        for wp in way_points:
            if not wp.name:
                continue
            p = wp.point.to_LV95()
            earlier = seen.get(wp.name, [])
            same_place = any(
                math.hypot(p.lat - q.lat, p.lon - q.lon) <= SAME_PLACE_DISTANCE
                for q in earlier
            )
            seen.setdefault(wp.name, []).append(p)
            if not earlier or same_place or wp.name.startswith("Punkt "):
                continue
            used = {_anchor(name) for name in seen}
            free = [
                a
                for a in getattr(wp, "name_alternatives", [])
                if a not in seen and _anchor(a) not in used
            ]
            if free:
                seen[wp.name].pop()
                wp.name = free[0]
                seen.setdefault(wp.name, []).append(p)
            elif wp.point.h > 0:
                wp.name = f"{wp.name} ({round(wp.point.h)})"
