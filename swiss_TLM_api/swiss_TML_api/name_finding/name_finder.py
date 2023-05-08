import logging
import time

from swiss_TML_api.name_finding.name_index import NameIndex

logger = logging.getLogger(__name__)


class NameFinder(NameIndex):

    def __init__(self, force_rebuild=False, reduced=False):
        """
            If force_rebuild is True, the index will be rebuilt (all old files will be removed).
            If force_rebuild is False, the index will be loaded from the filesystem (if it exists)
            or downloaded from Google Drive.

            If reduced is True, only the reduced index (city of Bern) will be used.
            Note: this index cannot be downloaded from Google Drive. It must be created form the original
            files provided by Swisstopo.

        """

        start = time.time()
        super().__init__(force_rebuild, reduced)
        end = time.time()

        logger.info('Name Index loaded (after {}s)'.format(str(end - start)))

    def __del__(self):
        self.index.close()

    def get_names(self, lat: float, lon: float, n=1):
        """
            See also https://api3.geo.admin.ch/api/faq/index.html#which-layers-have-a-tooltip
            fair use limit 20 Request per minute
            (see https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html)

            Therefore this process should be done locally.

        """

        logger.info("Search name for {} / {}.".format(lat, lon))
        start = time.time()

        list_of_points = list(self.index.nearest((lat, lon, lat, lon), num_results=n, objects='raw'))

        end = time.time()
        logger.info("Time for searching name: {}s".format(end - start))

        return list_of_points
