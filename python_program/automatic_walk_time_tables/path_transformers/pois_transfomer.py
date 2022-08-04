import logging

import numpy as np

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV03, Point_LV95


class POIsTransformer(PathTransformer):
    """
        Transformer which transforms a path to a path containing only pois.
    """

    def __init__(self, pois_list_as_str: str = '') -> None:
        super().__init__()
        self.pois_list_as_str = pois_list_as_str
        self.__logger = logging.getLogger(__name__)

    def transform(self, path: Path) -> Path:
        pois = Path([path.way_points[0].point])

        # calc extremums of path_
        max_index = np.argmax([p.point.h for p in path.way_points])
        min_index = np.argmin([p.point.h for p in path.way_points])

        pois.insert(path.way_points[max_index])
        pois.insert(path.way_points[min_index])

        pois_coord = []

        # TODO: calc points of interest if list is empty
        if self.pois_list_as_str != '':

            try:
                pois_strs = self.pois_list_as_str.split(';')
                for poi_str in pois_strs:
                    poi = poi_str.split(',')
                    poi = Point_LV95(float(poi[0]), float(poi[1]), 0)
                    pois_coord.append(poi)

            except Exception as e:
                logging.error(e)

        self.__logger.debug('POIs: %s', pois_coord)

        # find the nearest point for every point in pois_coords
        for poi in pois_coord:
            min_dist = np.inf
            min_index = 0
            for i, p in enumerate(path.way_points):

                p_lv95 = p.point.to_LV95()

                dist = (p_lv95.lat - poi.lat) ** 2 + (p_lv95.lon - poi.lon) ** 2
                if dist < min_dist:
                    min_dist = dist
                    min_index = i
            self.__logger.debug('Nearest point for %s is %s', poi, path.way_points[min_index])

            # Add POI if path crosses it with a distance of maximum 50m
            if min_dist <= 50:
                pois.insert(path.way_points[min_index])

        self.__logger.debug('POIs: %s', pois)

        # add endpoint to list of points of interest
        pois.append(path.way_points[-1])

        return pois
