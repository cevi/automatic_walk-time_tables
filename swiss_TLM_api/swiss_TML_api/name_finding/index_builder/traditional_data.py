import csv
import logging

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)


class TraditionalData(IndexBuilder):

    def load(self):
        # Linien (Verkehrsbauten, Sportanlagen, Fliessgewässern ...)
        self.add_to_database('./resources/swissNAMES3D_LIN.csv', 1, 5, 10, 11, 12)
        logger.debug("\tAdded 'swissNAMES3D_LIN'")

        # Punkte (Topografische Namen, Flur- und Lokalnamen, Gebäudenamen ...)
        self.add_to_database('./resources/swissNAMES3D_PKT.csv', 1, 6, 11, 12, 13)
        logger.debug("\tAdded 'swissNAMES3D_PKT'")

        # Polygone (Siedlungsnamen, Seenamen, Geländenamen ..)
        self.add_to_database('./resources/swissNAMES3D_PLY.csv', 1, 5, 10, 11, 12)
        logger.debug("\tAdded 'swissNAMES3D_PLY'")

    def add_to_database(self, file, typeIndex, name, x, y, h):
        with open(file, encoding="utf8") as file_data:
            reader = csv.reader(file_data, delimiter=';')
            next(reader)

            for r in reader:
                self.index.insert(0, (int(r[x]), int(r[y]), int(r[x]), int(r[y])),
                                  obj=SwissName(r[name], r[typeIndex], r[x], r[y], r[h]))
