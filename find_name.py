import csv
import math
from math import sqrt


class SwissName:

    def __init__(self, name, object_type, x, y):
        self.name = name
        self.object_type = object_type
        self.x = int(x)
        self.y = int(y)


def add_to_database(file, db, typeIndex, name, x, y):
    with open(file, encoding="utf8") as file_data:
        reader = csv.reader(file_data, delimiter=';')
        next(reader)
        for r in reader:
            db.append(SwissName(r[name], r[typeIndex], r[x], r[y]))


def find_name(coord, dist):
    list = [swiss_name
            for swiss_name in database if
            abs(swiss_name.x - coord[0]) < dist * 4 and
            abs(swiss_name.y - coord[1]) < dist * 4]

    # Suche nach der min. Distanz, dabei werden gewisse Objekte bevorzugt:
    # Turm, Haupthuegel, Huegel, Pass, Strassenpass, Alpiner Gipfel: 2.5
    # Kapelle: 2
    # Haltestelle Bus: 1.5
    # Gebaeude/ Offenes Gebaeude: 1.25
    # lokalname swisstopo: 1.2
    # Flurname swisstopo: 0.9

    list.sort(key=lambda swiss_name:
    math.sqrt((abs(swiss_name.x - coord[0]) ** 2 + abs(swiss_name.y - coord[1]) ** 2)) / (
        2 if swiss_name.object_type in ['Haupthuegel', 'Huegel', 'Pass', 'Strassenpass', 'Alpiner Gipfel', 'Gipfel',
                                        'Graben', 'Gletscher'] else
        1.25 if swiss_name.object_type in ['Kapelle', 'Turm', 'Schwimmbadareal', 'Campingplatzareal', 'Golfplatzareal',
                                           'Zooareal', 'Freizeitanlagenareal', 'Abwasserreinigungsareal', 'Friedhof',
                                           'Spitalareal', 'Quartierteil', 'Ort', 'See', 'Bach'] else
        1.15 if swiss_name.object_type in ['Haltestelle Bus', 'Haltestelle Schiff', 'Uebrige Bahnen',
                                           'Haltestelle Bahn'] else
        1.05 if swiss_name.object_type in ['Gebaeude', 'Offenes Gebaeude', 'Schul- und Hochschulareal'] else
        1 if swiss_name.object_type in ['Lokalname swisstopo', 'Flurname swisstopo', 'Tal', 'Grat'] else 0.95))

    if len(list) == 0:
        return ''

    return ('bei/m ' if sqrt(abs(list[0].x - coord[0]) ** 2 + abs(list[0].y - coord[1]) ** 2) > dist else '') + list[
        0].name


database = []

# Linien (Verkehrsbauten, Sportanlagen, Fliessgewässern ...)
add_to_database('swissNAMES3D_LIN.csv', database, 1, 5, 10, 11)

# Punkte (Topografische Namen, Flur- und Lokalnamen, Gebäudenamen ...)
add_to_database('swissNAMES3D_PKT.csv', database, 1, 6, 11, 12)

# Polygone (Siedlungsnamen, Seenamen, Geländenamen ..)
add_to_database('swissNAMES3D_PLY.csv', database, 1, 5, 10, 11)
