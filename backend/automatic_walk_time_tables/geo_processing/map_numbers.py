import json

import requests
import logging

logger = logging.getLogger(__name__)

from automatic_walk_time_tables.utils import path


def fetch_map_numbers(path_: path.Path) -> str:
    url = "http://awt-swiss-tml-api:1848/map_numbers"

    # Convert path to LV95 and save the coordinates in an array
    coordinates = [pkt.point.to_LV95() for pkt in path_.way_points]
    coordinates = [[pkt.lat, pkt.lon] for pkt in coordinates]

    payload = json.dumps(coordinates)
    headers = {"Content-Type": "application/json"}

    try:
        req = requests.request("GET", url, headers=headers, data=payload)
        return req.text
    except requests.exceptions.ConnectionError:
        logger.error("Connection error while fetching map numbers from awt-swiss-tml-api")
        return ""  # TODO: we ignore errors for now, see https://github.com/cevi/automatic_walk-time_tables/issues/247
