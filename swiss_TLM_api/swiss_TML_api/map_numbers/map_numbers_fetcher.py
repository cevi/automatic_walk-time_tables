import json
import logging
from typing import List

import requests
from flask import request

logger = logging.getLogger(__name__)


def is_in_bbox(bbox: List[float], lat: int, lon: int) -> bool:
    """
    Checks if a given GPX point in LV95 is inside a bounding box (given in LV95 coordinates).
    """

    return bbox[0] < lat < bbox[2] and bbox[1] < lon < bbox[3]


def sort_maps(s: str) -> int:
    """
    Carves out the LK or CN number and returns it as an integer
    This can be used to sort a list of map names.

    Sometimes, multiple map numbers are given XXXX/YYYY, so we only want the first one.
    """

    unbracketed_str = s.split("(")[1].split(")")[0]

    if 'CN ' in unbracketed_str:
        return int(unbracketed_str.split("CN ")[1].split("/")[0])

    return int(unbracketed_str.split("LK ")[1].split("/")[0])


def fetch_map_numbers():
    """
      Gets the Landeskarten-numbers around the start point of the tour. Then checks for each point, if it is inside one of the maps.
      If so, the card will be added and finally all cards are returned as a string sorted by number ascending.
    """
    lv95_coords = request.json

    logger.info("Fetch map numbers for %s", lv95_coords)

    base_url = "https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryFormat=geojson&geometryType" \
               "=esriGeometryPoint&lang=de&sr=2056&layers=all:ch.swisstopo.geologie-geologischer_atlas.metadata&limit" \
               "=50&returnGeometry=true&tolerance=100&"

    # Now we get all Landeskarte numbers from the API for the maps around start and end.
    # This means 1 request, which is below the fair use limit.

    url = base_url + f"geometry={lv95_coords[0][0]},{lv95_coords[0][1]}&imageDisplay=1283,937,96&mapExtent=400000,000000,900000,300000"  # extent in LV03

    result = requests.get(url)
    all_maps = []
    data = json.loads(result.content)

    for map in data["results"]:
        all_maps.append([map["properties"]["name"], map["bbox"]])

    needed_maps = set()

    for (lat, lon) in lv95_coords:
        for name, bbox in all_maps:
            if is_in_bbox(bbox, lat, lon):
                needed_maps.add(name)
                break

    maps_list = list(needed_maps)

    return ",".join(sorted(maps_list, key=sort_maps))
