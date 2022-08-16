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

    def __init__(self, min_number_of_points: int = 100, gabs_only: bool = False) -> None:
        super().__init__()

        self.__logger = logging.getLogger(__name__)
        self.min_number_of_points = min_number_of_points
        self.gabs_only = gabs_only

    def transform(self, path_: Path) -> Path:

        if self.gabs_only:
            self.__logger.info("Fetching elevation for gabs only")
            return self.transform_gabs(path_)

        return self._transform(path_)

    def transform_gabs(self, path_: Path):

        # find index of first point with elevation = 0
        first_gab_index = 0
        for i in range(len(path_.way_points)):
            if not path_.way_points[i].point.has_elevation():
                first_gab_index = i
                break

        # find index of last point with elevation = 0
        last_gab_index = 0
        for i in range(len(path_.way_points) - 1, -1, -1):
            if not path_.way_points[i].point.has_elevation():
                last_gab_index = i
                break

        if first_gab_index == len(path_.way_points) or first_gab_index == last_gab_index:
            return path_

        self.__logger.info("Found gabs in path")
        self.__logger.info("First gab index: " + str(first_gab_index))
        self.__logger.info("Last gab index: " + str(last_gab_index))

        # return path between the two indexes
        way_points_between = path_.way_points[first_gab_index:last_gab_index + 1]
        path_missing_elevation = Path(list(map(lambda x: x.point, way_points_between)))
        path_missing_elevation = self._transform(path_missing_elevation)

        # merge back together the two paths
        path_with_elevation = Path(
            list(map(lambda x: x.point, path_.way_points[:first_gab_index])) +
            list(map(lambda x: x.point, path_missing_elevation.way_points)) +
            list(map(lambda x: x.point, path_.way_points[last_gab_index + 1:])))

        return path_with_elevation

    def _transform(self, path_: Path) -> Path:

        # check that the path does not have more than 4000 points
        if len(path_.way_points) > 4000:
            raise Exception("Path has more than 4000 points, above rate limit.")

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

        return Path(points)
