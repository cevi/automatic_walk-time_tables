import csv
import logging
import time
from builtins import int

from rtree.index import Index as RTreeIndex

logger = logging.getLogger(__name__)


class SwissName:
    def __init__(self, name, object_type, x, y):
        self.name = name
        self.object_type = object_type
        self.x = int(x)
        self.y = int(y)


def add_to_database(file, index, typeIndex, name, x, y):
    with open(file, encoding="utf8") as file_data:
        reader = csv.reader(file_data, delimiter=';')
        next(reader)

        for r in reader:
            index.insert(0, (int(r[x]), int(r[y]), int(r[x]), int(r[y])),
                         obj=SwissName(r[name], r[typeIndex], r[x], r[y]))


def find_name(coord):
    """
        See also https://api3.geo.admin.ch/api/faq/index.html#which-layers-have-a-tooltip
        fair use limit 20 Request per minute
        (see https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html)

        Therefore this process should be done locally.

    """
    list_of_points = list(index.nearest((coord[0], coord[1], coord[0], coord[1]), 1, objects=True))
    return list_of_points[0].object.name


########################################################################################################################
########################################################################################################################
########################################################################################################################

# loads the data form the three CSV files into the "database"

start = time.time()

index_file_path = './automatic_walk_time_tables/res/swissname_data_index'

index = RTreeIndex(index_file_path)

if index.get_size() > 0:
    logger.debug('Index of size {} found  at {}'.format(index.get_size()), index_file_path)

else:
    logger.info('Start Creating Index: Save index in {}. This might take a few minutes.'.format(index_file_path))

    # Linien (Verkehrsbauten, Sportanlagen, Fliessgewässern ...)
    add_to_database('./automatic_walk_time_tables/res/swissNAMES3D_LIN.csv', index, 1, 5, 10, 11)

    # Punkte (Topografische Namen, Flur- und Lokalnamen, Gebäudenamen ...)
    add_to_database('./automatic_walk_time_tables/res/swissNAMES3D_PKT.csv', index, 1, 6, 11, 12)

    # Polygone (Siedlungsnamen, Seenamen, Geländenamen ..)
    add_to_database('./automatic_walk_time_tables/res/swissNAMES3D_PLY.csv', index, 1, 5, 10, 11)

    logger.debug('Creation of index completed')
    index.flush()

end = time.time()
logger.info('Index loaded (after {}s)'.format(str(end - start)))
