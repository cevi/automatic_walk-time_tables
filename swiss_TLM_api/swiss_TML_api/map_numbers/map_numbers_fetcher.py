import logging
import os
from typing import List
import requests
import time

from rtree.exceptions import RTreeError
from rtree.index import Index as RTreeIndex

logger = logging.getLogger(__name__)


class MapNumberIndex:
    """
    This class is used to find the map numbers for a given list of coordinates.
    """

    index_file_path = "./index_cache/map_numbers_index"

    def __init__(self, force_rebuild=False):
        if not os.path.exists("./index_cache"):
            # If it does not exist, create the directory
            os.makedirs("./index_cache")

        start = time.time()

        if force_rebuild:  # force_rebuild
            self.__download_map_numbers()
            end = time.time()
            logger.info(
                "Map numbers index created (after {}s)".format(str(end - start))
            )
            return

        # try to load the index
        try:
            if not os.path.isfile(self.index_file_path + ".dat"):
                self.__download_map_numbers()
            self.index = RTreeIndex(self.index_file_path)
        except:
            # if anything crashes somehow, redownload and recreate the index
            logger.info("Map numbers index was corrupt - rebuilding.")
            self.__download_map_numbers()
            self.index = RTreeIndex(self.index_file_path)

        end = time.time()
        logger.info("Map numbers index loaded (after {}s)".format(str(end - start)))

    def __download_map_numbers(self):
        try:
            os.remove(self.index_file_path + ".dat")
            os.remove(self.index_file_path + ".idx")
        except FileNotFoundError:
            pass

        self.index = RTreeIndex(self.index_file_path)

        # Build index using the swisstopo api
        base_url = "https://shop.swisstopo.admin.ch/de/api/geojson/814"
        response = requests.get(base_url)

        try:
            for feature in response.json()["features"]:
                coords = feature["geometry"]["coordinates"][0]  # get coords dict
                coords_x = coords[0][0], coords[2][0]
                coords_y = coords[0][1], coords[2][1]
                min_x = min(coords_x[0], coords_x[1])
                max_x = max(coords_x[0], coords_x[1])
                min_y = min(coords_y[0], coords_y[1])
                max_y = max(coords_y[0], coords_y[1])
                bbox = min_x, min_y, max_x, max_y  # build bbox list
                tit = feature["properties"]["title"]
                num = feature["properties"]["map_number"]

                self.index.insert(
                    id=0, coordinates=bbox, obj="{} ({})".format(tit, num)
                )
        except Exception as e:
            logger.error(e)

        self.index.flush()  # save the index to disk
        logger.info(f"Map numbers index created with {len(response.json()["features"])} boxes.")

    def fetch_map_numbers(self, coordinates: List[List[int]]) -> str:
        map_numbers_ = set()

        for lat, lon in coordinates:
            map_bboxes = list(
                self.index.nearest((lat, lon, lat, lon), num_results=9, objects=True)
            )

            for map_bbox in map_bboxes:
                if self.is_in_bbox(map_bbox.bbox, lat, lon):
                    map_numbers_.add(map_bbox.object)
        logger.info("Fetched Map Numbers: " + ", ".join(map_numbers_))
        return ", ".join(map_numbers_)

    def is_in_bbox(self, bbox: List[float], lat: int, lon: int, tol=2_000) -> bool:
        """
        Checks if a given GPX point in LV95 is inside a bounding box (given in LV95 coordinates).
        """

        return (bbox[0] - tol) < lat < (bbox[2] + tol) and (bbox[1] - tol) < lon < (
            bbox[3] + tol
        )


if __name__ == "__main__":
    index = MapNumberIndex()
    map_numbers = index.fetch_map_numbers([[2650000, 1200000]])
    print(map_numbers)
