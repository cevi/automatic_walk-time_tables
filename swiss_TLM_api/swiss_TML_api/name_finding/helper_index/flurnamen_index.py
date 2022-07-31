import logging

import fiona
from rtree.index import Index as RTreeIndex

from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class FlurnamenIndex:

    def __init__(self, shp_file):

        self.index_file_path = './index_cache/street_index'
        self.shp_file = shp_file

    def get_flurname_index(self):

        index_file_path = './index_cache/flurname_index'
        index = RTreeIndex(index_file_path)

        if index.get_size() > 0:
            logger.debug('\tCached index of size {} found'.format(index.get_size()))
            return index

        with fiona.open(self.shp_file) as src:
            for obj in src:
                (x, y, h) = obj['geometry']['coordinates']
                swiss_name = SwissName(
                    name=obj['properties']['NAME'],
                    object_type=obj['properties']['OBJEKTART'],
                    x=x, y=y, h=h)
                index.insert(id=0, coordinates=(x, y), obj=swiss_name)

        return index
