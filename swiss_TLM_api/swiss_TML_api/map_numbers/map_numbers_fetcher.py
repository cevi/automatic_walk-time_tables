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

    index_file_path = './index_cache/map_numbers_index'

    def __init__(self, force_rebuild=False):
        start = time.time()
        
        if force_rebuild:
            self.__download_map_numbers()
            end = time.time()
            logger.info('Map numbers index created (after {}s)'.format(str(end - start)))
            return

        # try to load the index
        try:
            self.index = RTreeIndex(self.index_file_path)
        except RTreeError as e:
            logger.error("Could not load index file for map numbers. " + str(e))

            # recreate the index.
            self.__download_map_numbers()
        end = time.time()
        logger.info('Map numbers index loaded (after {}s)'.format(str(end - start)))
            
    def __download_map_numbers(self):
        try:
            os.remove(self.index_file_path + '.dat')
            os.remove(self.index_file_path + '.idx')
        except FileNotFoundError:
            pass
        self.index = RTreeIndex(self.index_file_path)
        
        # Build index using the swisstopo api
        base_coordinates = [2650000, 1200000]

        base_url = "https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryFormat=geojson" \
                   "&geometryType=esriGeometryPoint&lang=de&sr=2056&layers=all:ch.swisstopo.pixelkarte-pk25.metadata" \
                   "&limit=50&returnGeometry=true&tolerance=10000&imageDisplay=1283,937,96&mapExtent=400000,000000," \
                   f"900000,300000&geometry={base_coordinates[0]},{base_coordinates[1]}"

        for i in range(0, 250, 50):
            url = base_url + f"&offset={i}"
            response = requests.get(url)
            if response.status_code != 200:
                logger.error("Could not get map numbers from swisstopo. Status code: {}".format(response.status_code))
                return

            for map_ in response.json()['results']:
                self.index.insert(id=0,
                                  coordinates=map_['bbox'],
                                  obj="{} ({})".format(map_["properties"]['lk_name'], map_["properties"]['tileid']))
            self.index.flush() # save the index to disk
        logger.info("Map numbers index created.")

    def fetch_map_numbers(self, coordinates: List[List[int]]) -> str:

        map_numbers_ = set()

        for lat, lon in coordinates:

            map_bboxes = list(self.index.nearest((lat, lon, lat, lon), num_results=9, objects=True))

            for map_bbox in map_bboxes:
                if self.is_in_bbox(map_bbox.bbox, lat, lon):
                    map_numbers_.add(map_bbox.object)

        return ', '.join(map_numbers_)

    def is_in_bbox(self, bbox: List[float], lat: int, lon: int, tol=2_000) -> bool:
        """
        Checks if a given GPX point in LV95 is inside a bounding box (given in LV95 coordinates).
        """

        return (bbox[0] - tol) < lat < (bbox[2] + tol) and (bbox[1] - tol) < lon < (bbox[3] + tol)


if __name__ == '__main__':
    index = MapNumberIndex()
    map_numbers = index.fetch_map_numbers([[2650000, 1200000]])
    print(map_numbers)
