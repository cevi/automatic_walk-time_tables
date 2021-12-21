import csv
import math
from math import sqrt

# Set up logging
from . import log_helper
import logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
handler.setFormatter(log_helper.Formatter())
logger.addHandler(handler)

class SwissName:
    def __init__(self, name, object_type, x, y):
        self.name = name
        self.object_type = object_type
        self.x = int(x)
        self.y = int(y)

def add_to_database(file, db, typeIndex, name, x, y):
    logger.debug("Adding file %s with name %s to database.", file, name)
    with open(file, encoding="utf8") as file_data:
        reader = csv.reader(file_data, delimiter=';')
        next(reader)
        for r in reader:
            db.append(SwissName(r[name], r[typeIndex], r[x], r[y]))
    logger.debug("Database has " + str(len(db)) + " entries.")

def find_name(coord, dist):
    """
        See also https://api3.geo.admin.ch/api/faq/index.html#which-layers-have-a-tooltip
        fair use limit 20 Request per minute
        (see https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html)

        Therefore this process should be done locally.

    """

    flurname_list = [swiss_name
                     for swiss_name in database if
                     abs(swiss_name.x - coord[0]) < dist * 4 and
                     abs(swiss_name.y - coord[1]) < dist * 4]

    # print(list(map(lambda x: x.name, flurname_list)))

    # Suche nach der min. Distanz, dabei werden gewisse Objekte bevorzugt:
    # Turm, Haupthuegel, Huegel, Pass, Strassenpass, Alpiner Gipfel: 2.5
    # Kapelle: 2
    # Haltestelle Bus: 1.5
    # Gebaeude/ Offenes Gebaeude: 1.25
    # lokalname swisstopo: 1.2
    # Flurname swisstopo: 0.9

    flurname_list.sort(key=lambda swiss_name:
    math.sqrt((abs(swiss_name.x - coord[0]) ** 2 + abs(swiss_name.y - coord[1]) ** 2)) / (
        2 if swiss_name.object_type in ['Haltestelle Bahn', 'Huegel', 'Pass', 'Strassenpass', 'Alpiner Gipfel',
                                        'Gipfel',
                                        ] else
        1.25 if swiss_name.object_type in ['Kapelle', 'Turm', 'Schwimmbadareal', 'Campingplatzareal', 'Golfplatzareal',
                                           'Zooareal', 'Freizeitanlagenareal', 'Abwasserreinigungsareal', 'Friedhof',
                                           'Spitalareal', 'Quartierteil', 'Ort', 'See', 'Bach',
                                           'Lokalname swisstopo'] else
        1.15 if swiss_name.object_type in ['Haltestelle Bus', 'Haltestelle Schiff', 'Uebrige Bahnen',
                                           'Haupthuegel'] else
        1.05 if swiss_name.object_type in ['Gebaeude', 'Offenes Gebaeude', 'Schul- und Hochschulareal'] else
        1 if swiss_name.object_type in ['Flurname swisstopo', 'Tal', 'Grat', 'Graben', 'Gletscher'] else 0.95))

    if len(flurname_list) == 0:
        return ''

    return ('bei/m ' if sqrt(
        abs(flurname_list[0].x - coord[0]) ** 2 + abs(flurname_list[0].y - coord[1]) ** 2) > dist else '') + \
           flurname_list[0].name


########################################################################################################################
########################################################################################################################
########################################################################################################################

# loads the data form the three CSV files into the "database"

database = []

# Linien (Verkehrsbauten, Sportanlagen, Fliessgewässern ...)
add_to_database('./res/swissNAMES3D_LIN.csv', database, 1, 5, 10, 11)

# Punkte (Topografische Namen, Flur- und Lokalnamen, Gebäudenamen ...)
add_to_database('./res/swissNAMES3D_PKT.csv', database, 1, 6, 11, 12)

# Polygone (Siedlungsnamen, Seenamen, Geländenamen ..)
add_to_database('./res/swissNAMES3D_PLY.csv', database, 1, 5, 10, 11)
