import json

import requests

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils.path import Path


class NamingTransformer(PathTransformer):
    """
    Fetches the names for each point in the path.
    """

    def __init__(self):
        super().__init__()

    def transform(self, path_: Path) -> Path:
        for pt in path_.way_points:
            url = "http://awt-swiss-tml-api:1848/swiss_name"

            lv95 = pt.point.to_LV95()
            payload = json.dumps([[lv95.lat, lv95.lon]])
            headers = {"Content-Type": "application/json"}
            req = requests.request("GET", url, headers=headers, data=payload)
            resp = req.json()

            # Use coordinate if next name is more than 100 meters away
            if resp[0]["offset"] <= 100:
                pt.name = resp[0]["swiss_name"]
            else:
                pt.name = ""

        return path_
