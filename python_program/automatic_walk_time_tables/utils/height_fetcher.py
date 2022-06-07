import json
import logging
from typing import List

import requests

from . import point, path
from .point import Point_LV03

logger = logging.getLogger(__name__)


def height_fetch_single_point(pt: point.Point_LV03) -> point.Point_LV03:
    """
    Fetch the elevation for a single point.
    """

    SINGLE_POINT_URL = "https://api3.geo.admin.ch/rest/services/height"

    params = {
        "easting": pt.lat,
        "northing": pt.lon,
        "sr": 21781  # LV03
    }

    r = requests.get(SINGLE_POINT_URL, params=params)

    logger.debug("Fetched elevation for point and got " + str(r.status_code))

    if r.status_code != 200:
        logger.debug("Status Code: " + str(r.status_code))
        logger.debug("Response: " + r.text)
        raise Exception("Failed to fetch elevation for point")

    # return the point with elevation
    logger.debug("Got height" + r.json()["height"])
    return point.Point_LV03(pt.lat, pt.lon, float(r.json()["height"]))


def height_fetch_path(path_: path.Path) -> path.Path:
    """
    Fetch the elevation for a path.
    """
    PATH_URL = "https://api3.geo.admin.ch/rest/services/profile.json"

    # check that the path does not have more than 5000 points
    if len(path_.way_points) > 5000:
        raise Exception("Path has more than 5000 points, above rate limit.")

    geom_data = {
        "type": "LineString",
        "coordinates": [
            [round(pt.point.lat), round(pt.point.lon)] for pt in path_.way_points
        ]
    }

    params = {
        "geom": json.dumps(geom_data),
        "nb_points": max(path_.number_of_waypoints, 2500),
        "distinct_points": True,
        "smart_filling": True,
        "sr": 21781  # LV03
    }

    r = requests.get(PATH_URL, params=params)
    logger.info(r.url)

    logger.debug("Fetched elevation for path part and got " + str(r.status_code))

    if r.status_code not in (200, 203):
        logger.debug("Status Code: " + str(r.status_code))
        logger.debug("Response: " + r.text)
        raise Exception("Failed to fetch elevation for path")

    # return the path with elevation
    points: List[Point_LV03] = []

    for entry in r.json():
        points.append(point.Point_LV03(entry["easting"], entry["northing"], float(entry["alts"]["COMB"])))

    return path.Path(points)
