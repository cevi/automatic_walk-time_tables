from __future__ import annotations

import json
import logging
import time
from typing import List, Optional

import requests

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils import point
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point, PointType
from automatic_walk_time_tables.utils.error import (
    ElevationServiceUnavailable,
    UserException,
)


class HeightFetcherTransformer(PathTransformer):
    """
    Fetch the elevation for a path and returns a new path with min_number_of_points of way_points.
    """

    PATH_URL = "https://api3.geo.admin.ch/rest/services/profile.json"

    # (connect, read) timeout in seconds; large profiles take up to ~25s
    TIMEOUT = (5, 40)
    MAX_ATTEMPTS = 3
    # status codes worth retrying, everything else fails immediately
    RETRY_STATUS = (429, 500, 502, 503, 504)
    MAX_BACKOFF = 5

    def __init__(self, min_number_of_points: int = 100) -> None:
        super().__init__()

        self.__logger = logging.getLogger(__name__)
        self.min_number_of_points = min_number_of_points

    def transform(self, path_: Path) -> Path:
        # check that the path does not have more than 5000 points
        if len(path_.way_points) > 5000:
            raise UserException(
                "Deine Datei hat zu viele Wegpunkte. Bitte reduziere die Anzahl Punkte und probier es erneut."
            )

        geom_data = {
            "type": "LineString",
            "coordinates": [
                [round(pt.point.lat), round(pt.point.lon)] for pt in path_.way_points
            ],
        }

        coord_type = path_.way_points[0].point.type
        params = {
            "nb_points": max(path_.number_of_waypoints, self.min_number_of_points),
            "distinct_points": True,
            "smart_filling": True,
            "sr": coord_type,
        }
        r = self.__fetch_profile(geom_data, params)

        # return the path with elevation
        points: List[Point] = []

        for entry in r.json():
            if coord_type == PointType.LV03:
                points.append(
                    point.Point_LV03(
                        entry["easting"],
                        entry["northing"],
                        float(entry["alts"]["COMB"]),
                    )
                )
            elif coord_type == PointType.LV95:
                points.append(
                    point.Point_LV95(
                        entry["easting"],
                        entry["northing"],
                        float(entry["alts"]["COMB"]),
                    )
                )
            elif coord_type == PointType.WGS84:
                points.append(
                    point.Point_WGS84(
                        entry["easting"],
                        entry["northing"],
                        float(entry["alts"]["COMB"]),
                    )
                )
            else:
                raise Exception("Unknown coordinate type")

        new_path = Path(points)
        new_path.route_name = path_.route_name
        return new_path

    def __fetch_profile(self, geom_data: dict, params: dict) -> requests.Response:
        """
        POST the line to geo.admin.ch and retry on rate limits, server errors and
        network problems. Raises ElevationServiceUnavailable once all attempts failed.
        """
        last_reason = ""
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            retry_after: Optional[str] = None
            try:
                r = requests.post(
                    self.PATH_URL,
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(geom_data),
                    params=params,
                    timeout=self.TIMEOUT,
                )
                self.__logger.info(r.url)

                if r.status_code in (200, 203):
                    return r

                last_reason = "status {}: {}".format(r.status_code, r.text[:500])
                self.__logger.warning(
                    "Elevation fetch attempt %d/%d failed with %s",
                    attempt,
                    self.MAX_ATTEMPTS,
                    last_reason,
                )
                if r.status_code not in self.RETRY_STATUS:
                    break
                retry_after = r.headers.get("Retry-After")

            except requests.RequestException as e:
                last_reason = "{}: {}".format(type(e).__name__, e)
                self.__logger.warning(
                    "Elevation fetch attempt %d/%d failed with %s",
                    attempt,
                    self.MAX_ATTEMPTS,
                    last_reason,
                )

            if attempt < self.MAX_ATTEMPTS:
                time.sleep(self.__backoff(attempt, retry_after))

        self.__logger.error("Failed to fetch elevation for path: %s", last_reason)
        raise ElevationServiceUnavailable()

    def __backoff(self, attempt: int, retry_after: Optional[str]) -> float:
        if retry_after is not None:
            try:
                return min(float(retry_after), self.MAX_BACKOFF)
            except ValueError:
                pass  # HTTP-date form, fall back to exponential backoff
        return min(2 ** (attempt - 1), self.MAX_BACKOFF)
