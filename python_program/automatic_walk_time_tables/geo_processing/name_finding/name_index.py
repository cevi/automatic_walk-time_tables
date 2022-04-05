import csv
import logging

from rtree.index import Index as RTreeIndex

from automatic_walk_time_tables.geo_processing.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)


class NameIndex:

    def __init__(self):
        self.index_file_path = './automatic_walk_time_tables/res/swissname_data_index'

        self.index = RTreeIndex(self.index_file_path)

        if self.index.get_size() > 0:
            logger.debug('Index of size {} found  at {}'.format(self.index.get_size(), self.index_file_path))

        else:
            self.generate_index()

    def add_to_database(self, file, typeIndex, name, x, y):
        with open(file, encoding="utf8") as file_data:
            reader = csv.reader(file_data, delimiter=';')
            next(reader)

            for r in reader:
                self.index.insert(0, (int(r[x]), int(r[y]), int(r[x]), int(r[y])),
                                  obj=SwissName(r[name], r[typeIndex], r[x], r[y]))

    def generate_index(self):
        logger.info(
            'Start Creating Index: Save index in {}. This might take a few minutes.'.format(self.index_file_path))

        # Linien (Verkehrsbauten, Sportanlagen, Fliessgewässern ...)
        self.add_to_database('./automatic_walk_time_tables/res/swissNAMES3D_LIN.csv', 1, 5, 10, 11)

        # Punkte (Topografische Namen, Flur- und Lokalnamen, Gebäudenamen ...)
        self.add_to_database('./automatic_walk_time_tables/res/swissNAMES3D_PKT.csv', 1, 6, 11, 12)

        # Polygone (Siedlungsnamen, Seenamen, Geländenamen ..)
        self.add_to_database('./automatic_walk_time_tables/res/swissNAMES3D_PLY.csv', 1, 5, 10, 11)

        logger.info('Creation of index completed')
        self.index.flush()
