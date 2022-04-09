import glob
import logging
import os
import time

from rtree.index import Index as RTreeIndex

from swiss_TML_api.name_finding.index_builder.forest_borders import ForestBorders
from swiss_TML_api.name_finding.index_builder.leisure_areals import LeisureAreals
from swiss_TML_api.name_finding.index_builder.stops_and_stations import StopsAndStations
from swiss_TML_api.name_finding.index_builder.tlm_streets import TLM_Streets

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def delete_file(pattern):
    files = glob.glob(pattern)

    for f in files:
        try:
            os.remove(f)
        except OSError as e:
            print("Error: %s : %s" % (f, e.strerror))


class NameIndex:

    def __init__(self, force_rebuild, reduced):
        self.index_file_path = './index_cache/swissname_data_index'

        if force_rebuild:
            delete_file('./index_cache/*.dat')
            delete_file('./index_cache/*.idx')

        self.index = RTreeIndex(self.index_file_path)

        if self.index.get_size() > 0:
            logger.debug('Index of size {} found  at {}'.format(self.index.get_size(), self.index_file_path))

        else:
            self.generate_index(reduced)

    def generate_index(self, reduced):

        logger.info(
            'Start Creating Index: Save index in {}. This might take a few minutes.'.format(self.index_file_path))

        index_parts = [ForestBorders, TLM_Streets, StopsAndStations, LeisureAreals]
        for index_part in index_parts:
            start = time.time()
            logger.info("\tInsertion of {} started...".format(index_part.__name__))

            loader = index_part(self.index, reduced=reduced)
            loader.load()

            end = time.time()
            logger.info("\tInsertion completed. Time needed: {}s".format(end - start))

        logger.info('Creation of index completed')
        self.index.flush()
        logger.info('Index flushed!')
