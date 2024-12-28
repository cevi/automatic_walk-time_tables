import json

import requests

import logging

logger = logging.getLogger(__name__)

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils.path import Path


class NamingTransformer(PathTransformer):
    """
    Fetches the names for each point in the path.
    """

    def __init__(self, use_default_name: bool = False):
        super().__init__()
        self.use_default_name = use_default_name

    def transform(self, path_: Path) -> Path:
        for pt in path_.way_points:
            pt.name = ""  # set default name to empty string

            url = "http://awt-swiss-tml-api:1848/swiss_name"

            lv95 = pt.point.to_LV95()
            payload = json.dumps([[lv95.lat, lv95.lon]])
            headers = {"Content-Type": "application/json"}

            try:
                req = requests.request("GET", url, headers=headers, data=payload)
                resp = req.json()

                pt.name = resp[0]["swiss_name"]

            except requests.exceptions.ConnectionError:
                logger.error(
                    "Connection error while fetching names from awt-swiss-tml-api"
                )
                continue  # TODO: we skip connection errors (see https://github.com/cevi/automatic_walk-time_tables/issues/247)

        return path_
