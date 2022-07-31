import logging
import pathlib
from typing import List, TextIO

import gpxpy

from . import path
from . import point
from ..path_transformers.heigth_fetcher_transfomer import HeightFetcherTransformer


class GeoFileParser(object):
    """
    Simple file parser for different types of GeoFiles. This class can parse GPX and KML files.
    It creates objects of type path.Path containing the waypoints of the GeoFile.
    """

    def __init__(self):
        self.__logger = logging.getLogger(__file__)
        self.height_fetcher = HeightFetcherTransformer(min_number_of_points=2500)

    def parse(self, file_name: str) -> path.Path:
        route_file = open(file_name, 'r')
        self.__logger.debug("Reading %s", file_name)

        # get the extension of the file
        extension = pathlib.Path(file_name).suffix

        if extension == '.gpx':
            return self.__parse_gpx_file(route_file)
        elif extension == '.kml':
            return self.parse_kml_file__(route_file)
        else:
            raise Exception('Unsupported file format')

    def __parse_gpx_file(self, gpx_raw_data: TextIO) -> path.Path:
        gpx: gpxpy.gpx = gpxpy.parse(gpx_raw_data)
        paths: List[path.Path] = []
        for track in gpx.tracks:
            for segment in track.segments:
                points: List[point.Point_WGS84] = []
                for p in segment.points:
                    points.append(point.Point_WGS84(p.latitude, p.longitude, p.elevation))
                paths.append(path.Path(points))

        if len(paths) > 1:
            raise Exception('More than one track found')

        if len(paths) == 0:
            raise Exception('No track found')

        path_ = paths[0]
        path_.route_name = gpx.name if gpx.name else ""
        if not path_.has_elevation_for_all_points():
            path_ = self.height_fetcher.transform(path_)
        else:
            pass  # all good, GPX has elevation data

        self.__logger.debug("Loaded GPX file with " + str(path_.number_of_waypoints) + " coordinates.")

        return path_

    def parse_kml_file__(self, file_path: TextIO) -> path.Path:
        raw_data = file_path.read()

        # find <LineString> and </LineString>
        start_index = raw_data.find('<LineString>')
        end_index = raw_data.find('</LineString>')

        # check if <LineString> and </LineString> are found
        if start_index == -1 or end_index == -1:
            raise Exception('No <LineString> or </LineString> found')

        # remove <LineString> and </LineString>
        raw_data = raw_data[start_index + len('<LineString>'):end_index]

        # carve out contents of <coordinates>...</coordinates>
        start_index = raw_data.find('<coordinates>')
        end_index = raw_data.find('</coordinates>')

        # check if <coordinates> and </coordinates> are found
        if start_index == -1 or end_index == -1:
            raise Exception('No <coordinates> or </coordinates> found')

        # remove <coordinates> and </coordinates>
        raw_data = raw_data[start_index + len('<coordinates>'):end_index]

        coordinates = raw_data.split(' ')
        coordinates = [c.split(',') for c in coordinates]
        has_elevation = len(coordinates[0]) == 3

        self.__logger.debug("Loaded KML file with " + str(len(coordinates)) + " coordinates.")

        if not has_elevation:
            # convert the first pair of coordinates to floats and compare them
            # if the first is bigger, then the coordinates are in lat, lon
            # if the first is smaller, then the coordinates are in lon, lat, we need to swap them
            c1 = float(coordinates[0][0])
            c2 = float(coordinates[0][1])
            if c1 < c2:
                # file actually has latitudes and longitudes flipped
                coordinates = [point.Point_WGS84(float(c[1]), float(c[0])) for c in coordinates]
            else:
                coordinates = [point.Point_WGS84(float(c[0]), float(c[1])) for c in coordinates]

            path_ = path.Path(coordinates)
            path_ = self.height_fetcher.transform(path_)

            return path_

        c1 = float(coordinates[0][0])
        c2 = float(coordinates[0][1])
        if c1 < c2:
            # latitudes and longitudes are flipped
            coordinates = [point.Point_WGS84(float(c[1]), float(c[0]), float(c[2])) for c in coordinates]
        else:
            coordinates = [point.Point_WGS84(float(c[0]), float(c[1]), float(c[2])) for c in coordinates]

        return path.Path(coordinates)
