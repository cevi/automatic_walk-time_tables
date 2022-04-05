import logging
import time

from automatic_walk_time_tables.geo_processing.name_finding.name_index import NameIndex

logger = logging.getLogger(__name__)


class NameFinder(NameIndex):

    def __init__(self):

        start = time.time()
        super().__init__()
        end = time.time()

        logger.info('Index loaded (after {}s)'.format(str(end - start)))

    def get_name(self, lat: float, lon: float):
        """
            See also https://api3.geo.admin.ch/api/faq/index.html#which-layers-have-a-tooltip
            fair use limit 20 Request per minute
            (see https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html)

            Therefore this process should be done locally.

        """
        list_of_points = list(self.index.nearest((lat, lon, lat, lon), 1, objects=True))
        return list_of_points[0].object.name
