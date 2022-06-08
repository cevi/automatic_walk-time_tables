import json

import requests

from automatic_walk_time_tables.utils import path


def fetch_map_numbers(path_: path.Path) -> str:
    url = "http://swiss_tml:1848/map_numbers"

    # Convert path to LV95 and save the coordinates in an array
    coordinates = [pkt.point.to_LV95() for pkt in path_.way_points]
    coordinates = [[pkt.lat, pkt.lon] for pkt in coordinates]

    payload = json.dumps(coordinates)
    headers = {'Content-Type': 'application/json'}
    req = requests.request("GET", url, headers=headers, data=payload)

    return req.text
