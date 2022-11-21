from __future__ import annotations

import json
import logging
from typing import List

import requests

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils import point
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point, PointType


class HeightFetcherTransformer(PathTransformer):
    """
    Fetch the elevation for a path and returns a new path with min_number_of_points of way_points.
    """

    PATH_URL = "https://api3.geo.admin.ch/rest/services/profile.json"

    def __init__(self, min_number_of_points: int = 100) -> None:
        super().__init__()

        self.__logger = logging.getLogger(__name__)
        self.min_number_of_points = min_number_of_points

    def transform(self, path_: Path) -> Path:

        # check that the path does not have more than 5000 points
        if len(path_.way_points) > 5000:
            raise Exception("Path has more than 5000 points, above rate limit.")

        geom_data = {
            "type": "LineString",
            "coordinates": [
                [round(pt.point.lat), round(pt.point.lon)] for pt in path_.way_points
            ]
        }

        coord_type = path_.way_points[0].point.type

        params = {
            "geom": json.dumps(geom_data),
            "nb_points": max(path_.number_of_waypoints, self.min_number_of_points),
            "distinct_points": True,
            "smart_filling": True,
            "sr": coord_type
        }

        r = requests.get(self.PATH_URL, params=params)
        self.__logger.info(r.url)

        self.__logger.debug("Fetched elevation for path part and got " + str(r.status_code))

        if r.status_code not in (200, 203):
            self.__logger.debug("Status Code: " + str(r.status_code))
            self.__logger.debug("Response: " + r.text)
            raise Exception("Failed to fetch elevation for path")

        # return the path with elevation
        points: List[Point] = []

        for entry in r.json():

            if coord_type == PointType.LV03:
                points.append(point.Point_LV03(entry["easting"], entry["northing"], float(entry["alts"]["COMB"])))
            elif coord_type == PointType.LV95:
                points.append(point.Point_LV95(entry["easting"], entry["northing"], float(entry["alts"]["COMB"])))
            elif coord_type == PointType.WGS84:
                points.append(point.Point_WGS84(entry["easting"], entry["northing"], float(entry["alts"]["COMB"])))
            else:
                raise Exception("Unknown coordinate type")

        new_path = Path(points)
        new_path.route_name = path_.route_name
        return new_path
