import logging
import time

from rtree.index import Index as RTreeIndex

from swiss_TML_api.name_finding.index_builder.forest_borders import ForestBorders
from swiss_TML_api.name_finding.index_builder.tlm_streets import TLM_Streets
from swiss_TML_api.name_finding.index_builder.traditional_data import TraditionalData

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class NameIndex:

    def __init__(self):
        self.index_file_path = './index_cache/swissname_data_index'

        self.index = RTreeIndex(self.index_file_path)

        if self.index.get_size() > 0:
            logger.debug('Index of size {} found  at {}'.format(self.index.get_size(), self.index_file_path))

        else:
            self.generate_index()

    def generate_index(self):

        logger.info(
            'Start Creating Index: Save index in {}. This might take a few minutes.'.format(self.index_file_path))

        index_parts = [ForestBorders, TraditionalData]  # TraditionalData
        for index_part in index_parts:
            start = time.time()
            logger.info("\tInsertion of {} started...".format(index_part.__name__))

            loader = index_part(self.index)
            loader.load()

            end = time.time()
            logger.info("\tInsertion completed. Time needed: {}s".format(end - start))

        logger.info('Creation of index completed')
        self.index.flush()
        logger.info('Index flushed!')
