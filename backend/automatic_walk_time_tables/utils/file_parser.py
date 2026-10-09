from __future__ import annotations

import logging
import pathlib
from typing import List

import gpxpy

from . import kml_parser
from . import path
from . import point
from ..path_transformers.heigth_fetcher_transfomer import HeightFetcherTransformer


class GeoFileParser(object):
    """
    Simple file parser for different types of GeoFiles. This class can parse GPX and KML files.
    It creates objects of type path.Path containing the waypoints of the GeoFile.
    """

    def __init__(self, fetch_elevation=True):
        """
        Constructor for GeoFileParser. This class can parse GPX and KML files.

        :param fetch_elevation: If true, the parser will fetch the elevation for all
        points (if not already present in the parsed file)

        """
        self.__logger = logging.getLogger(__file__)
        self.height_fetcher = HeightFetcherTransformer(min_number_of_points=2500)
        self.fetch_elevation = fetch_elevation

    def parse(
        self,
        file_path: str = None,
        file_content: str = "",
        extension: str | None = None,
    ) -> path.Path:
        """
        Parses a file and returns a path.Path object. As an input, the file_path or file_content parameter must be set.
        If both the file_path and file_content parameters are set, the file_path parameter is used.

        Supported file types: GPX and KML

        :param file_path: Path to a local file. The parser will open and parse that file.
        :param file_content: Content of a file. The parser will parse this content.
        :param extension: Must be set if the file_content is passed.

        :return: path.Path object.

        """

        # Check if file is valid
        if file_content == "" and extension is None:
            raise Exception("No file extension provided.")

        self.__logger.debug("File Extension: %s", extension)

        if file_path is not None:
            self.__logger.info("Reading %s", file_path)

            file_io = open(file_path, "r")
            if file_io is None:
                raise Exception("Could not open file " + file_path)

            file_content = file_io.read()
            extension = pathlib.Path(file_path).suffix[1:]

        if extension == "gpx":
            return self.__parse_gpx_file(file_content)
        elif extension == "kml":
            return self.parse_kml_file__(file_content)
        elif extension == "array":
            return self.parse_array_file__(file_content)
        else:
            raise Exception("Unsupported file format")

    def parse_array_file__(self, raw_data: str) -> path.Path:

        coordinates = raw_data.split(";")
        coordinates = [c.split(",") for c in coordinates]

        if len(coordinates[0]) == 2:
            coordinates = [
                point.Point_LV95(float(c[0]), float(c[1])) for c in coordinates
            ]
        else:
            coordinates = [
                point.Point_LV95(float(c[0]), float(c[1]), float(c[2]))
                for c in coordinates
            ]

        path_ = path.Path(coordinates)

        if not path_.has_elevation_for_all_points():
            path_ = self.height_fetcher.transform(path_)
        else:
            pass

        return path_

    def __parse_gpx_file(self, gpx_raw_data: str) -> path.Path:
        gpx: gpxpy.gpx = gpxpy.parse(gpx_raw_data)
        paths: List[path.Path] = []
        for track in gpx.tracks:
            for segment in track.segments:
                points: List[point.Point_WGS84] = []
                for p in segment.points:
                    # track points without <ele> have no elevation
                    elevation = -1.0 if p.elevation is None else p.elevation
                    points.append(point.Point_WGS84(p.latitude, p.longitude, elevation))
                paths.append(path.Path(points))

        if len(paths) > 1:
            raise Exception("More than one track found")

        if len(paths) == 0:
            raise Exception("No track found")

        path_ = paths[0]
        path_.route_name = gpx.name if gpx.name else ""
        if not path_.has_elevation_for_all_points():
            path_ = self.height_fetcher.transform(path_)
        else:
            pass  # all good, GPX has elevation data

        self.__logger.debug(
            "Loaded GPX file with " + str(path_.number_of_waypoints) + " coordinates."
        )

        return path_

    def parse_kml_file__(self, raw_data: str) -> path.Path:
        route = kml_parser.parse_kml(raw_data)
        self.__logger.debug("Route name: %s", route.name)

        # KML stores the coordinates as lon, lat. However, some files have them flipped.
        # In Switzerland the latitude is always bigger than the longitude,
        # thus we use the first pair of coordinates to detect the order.
        c1, c2, _ = route.coordinates[0]
        if c1 < c2:
            coordinates = [
                point.Point_WGS84(lat, lon, -1.0 if h is None else h)
                for lon, lat, h in route.coordinates
            ]
        else:
            coordinates = [
                point.Point_WGS84(lat, lon, -1.0 if h is None else h)
                for lat, lon, h in route.coordinates
            ]

        path_ = path.Path(coordinates)

        # Many KML files have no elevation, or (e.g. the ones from swisstopo) include
        # elevation=0 for all points. Fetch real elevation data from the API instead.
        if not path_.has_elevation_for_all_points() and self.fetch_elevation:
            path_ = self.height_fetcher.transform(path_)

        path_.route_name = route.name
        return path_
