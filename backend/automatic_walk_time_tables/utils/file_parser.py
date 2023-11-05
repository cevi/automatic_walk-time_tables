from __future__ import annotations

import logging
import pathlib
from typing import List

import gpxpy

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
        else:
            raise Exception("Unsupported file format")

    def __parse_gpx_file(self, gpx_raw_data: str) -> path.Path:
        gpx: gpxpy.gpx = gpxpy.parse(gpx_raw_data)
        paths: List[path.Path] = []
        for track in gpx.tracks:
            for segment in track.segments:
                points: List[point.Point_WGS84] = []
                for p in segment.points:
                    points.append(
                        point.Point_WGS84(p.latitude, p.longitude, p.elevation)
                    )
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
        # see if <name>...</name> is present
        start_index = raw_data.find("<name>")
        end_index = raw_data.find("</name>")
        route_name = ""
        if start_index != -1 and end_index != -1:
            route_name = raw_data[start_index + len("<name>") : end_index]
            self.__logger.debug("Route name: %s", route_name)

        # find <LineString> and </LineString>
        start_index = raw_data.find("<LineString>")
        end_index = raw_data.find("</LineString>")

        is_circular = False

        # check if <LineString> and </LineString> are found
        if start_index == -1 or end_index == -1:
            self.__logger.info(
                "No <LineString> or </LineString> found --> circular path"
            )
            is_circular = True

            # check for circular path
            start_index = raw_data.find("<LinearRing>")
            end_index = raw_data.find("</LinearRing>")

            if start_index == -1 or end_index == -1:
                raise Exception("No <LinearRing> or </LinearRing> found")

            # remove <LinearRing> and </LinearRing>
            raw_data = raw_data[start_index + len("<LinearRing>") : end_index]
        else:
            # remove <LineString> and </LineString>
            raw_data = raw_data[start_index + len("<LineString>") : end_index]

        # carve out contents of <coordinates>...</coordinates>
        start_index = raw_data.find("<coordinates>")
        end_index = raw_data.find("</coordinates>")

        # check if <coordinates> and </coordinates> are found
        if start_index == -1 or end_index == -1:
            raise Exception("No <coordinates> or </coordinates> found")

        # remove <coordinates> and </coordinates>
        raw_data = raw_data[start_index + len("<coordinates>") : end_index]

        coordinates = raw_data.split(" ")
        coordinates = [c.split(",") for c in coordinates]
        has_elevation = len(coordinates[0]) == 3

        if is_circular:
            # if circular, add the first point again in the end (close circuit)
            coordinates.append(coordinates[0])

        self.__logger.debug(
            "Loaded KML file with " + str(len(coordinates)) + " coordinates."
        )

        if not has_elevation:
            # convert the first pair of coordinates to floats and compare them
            # if the first is bigger, then the coordinates are in lat, lon
            # if the first is smaller, then the coordinates are in lon, lat, we need to swap them
            c1 = float(coordinates[0][0])
            c2 = float(coordinates[0][1])
            if c1 < c2:
                # file actually has latitudes and longitudes flipped
                coordinates = [
                    point.Point_WGS84(float(c[1]), float(c[0])) for c in coordinates
                ]
            else:
                coordinates = [
                    point.Point_WGS84(float(c[0]), float(c[1])) for c in coordinates
                ]

            path_ = path.Path(coordinates)

            if self.fetch_elevation:
                path_ = self.height_fetcher.transform(path_)

            path_.route_name = route_name if route_name else ""

            return path_

        c1 = float(coordinates[0][0])
        c2 = float(coordinates[0][1])
        if c1 < c2:
            # latitudes and longitudes are flipped
            coordinates = [
                point.Point_WGS84(float(c[1]), float(c[0]), float(c[2]))
                for c in coordinates
            ]
        else:
            coordinates = [
                point.Point_WGS84(float(c[0]), float(c[1]), float(c[2]))
                for c in coordinates
            ]

        path_ = path.Path(coordinates)
        path_.route_name = route_name if route_name else ""
        return path_
