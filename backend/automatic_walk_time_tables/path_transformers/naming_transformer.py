import logging
from typing import List

import requests

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils import swiss_tlm_api
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)


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
            names = [{"name": "", "object_type": "", "offset": None}] * len(coords)

        for wp, (e, n), r in zip(way_points, coords, names):
            wp.name = r["name"]
            wp.name_type = r["object_type"]
            landmark = getattr(wp, "landmark", None)
            if landmark is not None and landmark.name:
                # a station, hut, summit, ... is named after itself, even if the naming service ranks
                # something else nearby higher (e.g. a hotel next to the cable car station)
                wp.name = landmark.name
                wp.name_type = landmark.name_type or ""
            if not wp.name and self.use_default_name:
                wp.name = f"{round(e)}, {round(n)}"

        if self.disambiguate:
            self._disambiguate(way_points)

    @staticmethod
    def _disambiguate(way_points: List[WayPoint]):
        seen = set()
        for wp in way_points:
            if not wp.name:
                continue
            if wp.name in seen and wp.point.h > 0:
                wp.name = f"{wp.name} ({round(wp.point.h)})"
            seen.add(wp.name)
