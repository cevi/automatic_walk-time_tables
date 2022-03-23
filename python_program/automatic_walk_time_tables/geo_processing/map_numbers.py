import json
import logging
from typing import List

import requests

from automatic_walk_time_tables.utils import path, point

logger = logging.getLogger(__name__)


def is_in_bbox(bbox: List[float], point : point.Point_LV03) -> bool:
    """ 
    Checks if a given GPX point in LV03 is inside a bounding box (given in LV03 coordinates).
    """

    return bbox[0] < point.lat < bbox[2] and bbox[1] < point.lon < bbox[3]

def sort_maps(s: str) -> int:
    """
    Carves out the LK number and returns it as an integer
    This can be used to sort a list of map names.
    """
    return int(s.split("(")[1].split(")")[0].split("LK ")[1])


def find_map_numbers(path : path.Path) -> str:
    """
    Gets the Landeskarten-numbers around the start point of the tour. Then checks for each point, if it is inside one of the maps.
    If so, the card will be added and finally all cards are returned as a string sorted by number ascending.
    """
    base_url = "https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryFormat=geojson&geometryType=esriGeometryPoint&lang=de&layers=all:ch.swisstopo.geologie-geologischer_atlas.metadata&limit=50&returnGeometry=true&tolerance=100&"

    # get lv95 coordinates for the start point
    start_point : point.Point_LV03 = path.points[0].to_LV03()

    # Now we get all Landeskarte numbers from the API for the maps around start and end.
    # This means 1 request, which is below the fair use limit.
    url = base_url + f"geometry={start_point.lat},{start_point.lon}&imageDisplay=1283,937,96&mapExtent=400000,000000,900000,300000" # extent in LV03

    logger.debug("Fetching " + url)
    result = requests.get(url)

    all_maps = []
    data = json.loads(result.content)
    for map in data["results"]:
        all_maps.append([map["properties"]["name_de"], map["bbox"]])

    needed_maps = set()

    for p in path.points:
        for name, bbox in all_maps:
            if is_in_bbox(bbox, p):
                needed_maps.add(name)
                break

    maps_list = list(needed_maps)
    return ",".join(sorted(maps_list, key=sort_maps))
