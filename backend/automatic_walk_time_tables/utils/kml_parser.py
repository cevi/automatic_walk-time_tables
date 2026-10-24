from __future__ import annotations

import logging
import math
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .error import UserException

# A coordinate tuple in the order it is stored in the file (KML: lon, lat, altitude).
# The altitude is None if the file does not provide a usable one.
Coordinate = Tuple[float, float, Optional[float]]

# Features that carry a <name> and can contain geometries (directly or nested).
FEATURES = {"Document", "Folder", "Placemark"}

# For these modes the altitude is measured from the ground or the sea floor
# (or ignored), i.e. it is not an elevation above sea level.
NON_ABSOLUTE_ALTITUDE_MODES = {
    "relativeToGround",
    "relativeToSeaFloor",
    "clampToSeaFloor",
}

# Two lines are joined if the gap between them is smaller than this (roughly 10 m).
JOIN_TOLERANCE_DEG = 1e-4

logger = logging.getLogger(__name__)


@dataclass
class KmlLine:
    name: str = ""
    coordinates: List[Coordinate] = field(default_factory=list)


class _NoDoctypeTreeBuilder(ET.TreeBuilder):
    """
    KML does not need a DTD. Refusing it protects against entity expansion attacks.
    """

    def doctype(self, name, pubid, system):
        raise UserException(
            "Die KML-Datei enthält eine DTD-Deklaration und kann nicht eingelesen werden."
        )


def parse_kml(raw_data: str) -> KmlLine:
    """
    Extracts the route of a KML file.

    Supported are all geometries of the KML standard that describe a line:
    LineString, LinearRing, Polygon (outer boundary), gx:Track / gx:MultiTrack
    (and their KML 2.3 counterparts), also nested in a MultiGeometry.
    The elements are matched by their local name, thus the parser works for
    KML 2.0 - 2.3 files regardless of the namespace (prefix) they use.

    If the file contains several lines, consecutive lines are joined as long as
    each of them starts where the previous one ended. All remaining lines are ignored.
    """

    try:
        parser = ET.XMLParser(target=_NoDoctypeTreeBuilder())
        root = ET.fromstring(raw_data.lstrip("﻿ \t\r\n"), parser=parser)
    except ET.ParseError as e:
        logger.info("Invalid KML file: %s", e)
        raise UserException(
            "Die KML-Datei konnte nicht gelesen werden, sie ist kein gültiges XML."
        )

    lines: List[KmlLine] = []
    _collect_lines(root, "", lines)
    lines = [line for line in lines if len(line.coordinates) >= 2]

    if len(lines) == 0:
        if any(_local_name(el) == "NetworkLink" for el in root.iter()):
            raise UserException(
                "Die KML-Datei verweist nur auf eine externe Datei (NetworkLink). "
                "Bitte lade die verlinkte KML-Datei direkt hoch."
            )
        raise UserException(
            "Die KML-Datei enthält keine Route (Linie, Fläche oder Track)."
        )

    route = lines[0]
    for i, line in enumerate(lines[1:], start=1):
        if not _is_close(route.coordinates[-1], line.coordinates[0]):
            logger.warning(
                "KML file contains %d lines which are not connected, ignoring the last %d.",
                len(lines),
                len(lines) - i,
            )
            break
        route.coordinates.extend(line.coordinates[1:])

    logger.debug("Loaded KML file with %d coordinates.", len(route.coordinates))
    return route


def _local_name(element: ET.Element) -> str:
    # Comments and processing instructions do not have a string as tag.
    if not isinstance(element.tag, str):
        return ""
    return element.tag.rsplit("}", 1)[-1]


def _child_text(element: ET.Element, name: str) -> str:
    for child in element:
        if _local_name(child) == name:
            return "".join(child.itertext()).strip()
    return ""


def _collect_lines(element: ET.Element, name: str, lines: List[KmlLine]) -> None:
    """
    Walks through the tree in document order and appends all lines to the passed list.
    A line is named after the closest feature (Placemark, Folder, Document) that has a name.
    """

    tag = _local_name(element)

    if tag in FEATURES:
        name = _child_text(element, "name") or name

    if tag == "LineString":
        lines.append(KmlLine(name, _read_coordinates(element)))

    elif tag == "LinearRing":
        lines.append(KmlLine(name, _close_ring(_read_coordinates(element))))

    elif tag == "Polygon":
        # The route follows the outer boundary, holes (innerBoundaryIs) are ignored.
        for boundary in element:
            if _local_name(boundary) == "outerBoundaryIs":
                for child in boundary:
                    _collect_lines(child, name, lines)

    elif tag == "Track":
        lines.append(KmlLine(name, _read_track(element)))

    elif tag == "MultiTrack":
        # The tracks of a MultiTrack form one path, even if there are gaps in between.
        coordinates: List[Coordinate] = []
        for child in element:
            if _local_name(child) == "Track":
                coordinates.extend(_read_track(child))
        lines.append(KmlLine(name, coordinates))

    else:
        for child in element:
            _collect_lines(child, name, lines)


def _has_absolute_altitude(geometry: ET.Element) -> bool:
    return _child_text(geometry, "altitudeMode") not in NON_ABSOLUTE_ALTITUDE_MODES


def _read_coordinates(geometry: ET.Element) -> List[Coordinate]:
    """
    Reads the <coordinates> of a geometry: tuples of lon,lat[,altitude] which are
    separated by any kind of whitespace (spaces, tabs or newlines).
    """

    # Not valid, but common: whitespace after the commas within a tuple.
    text = re.sub(r"\s*,\s*", ",", _child_text(geometry, "coordinates"))
    keep_altitude = _has_absolute_altitude(geometry)
    return [_to_coordinate(t.split(","), keep_altitude) for t in text.split()]


def _read_track(track: ET.Element) -> List[Coordinate]:
    """
    Reads the <gx:coord> elements of a track, each of them contains a single
    tuple of lon lat [altitude] separated by spaces.
    """

    keep_altitude = _has_absolute_altitude(track)
    coordinates: List[Coordinate] = []
    for child in track:
        if _local_name(child) != "coord":
            continue

        values = "".join(child.itertext()).split()
        if len(values) == 0:
            continue  # an empty <gx:coord/> marks a missing position

        coordinates.append(_to_coordinate(values, keep_altitude))

    return coordinates


def _to_coordinate(values: List[str], keep_altitude: bool) -> Coordinate:
    try:
        if len(values) not in (2, 3):
            raise ValueError("Expected 2 or 3 values, got %d" % len(values))

        numbers = [float(v) for v in values]
        if not all(math.isfinite(n) for n in numbers):
            raise ValueError("Value is not finite")
        if abs(numbers[0]) > 180 or abs(numbers[1]) > 180:
            raise ValueError("Value is out of range")

    except ValueError as e:
        logger.info("Invalid KML coordinate %s: %s", values, e)
        raise UserException("Die KML-Datei enthält ungültige Koordinaten.")

    altitude = numbers[2] if len(numbers) == 3 and keep_altitude else None
    return numbers[0], numbers[1], altitude


def _close_ring(coordinates: List[Coordinate]) -> List[Coordinate]:
    if len(coordinates) > 0 and coordinates[0][:2] != coordinates[-1][:2]:
        coordinates.append(coordinates[0])
    return coordinates


def _is_close(a: Coordinate, b: Coordinate) -> bool:
    return (
        abs(a[0] - b[0]) < JOIN_TOLERANCE_DEG and abs(a[1] - b[1]) < JOIN_TOLERANCE_DEG
    )
