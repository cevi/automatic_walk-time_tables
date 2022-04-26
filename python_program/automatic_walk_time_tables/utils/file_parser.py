from io import TextIOWrapper
from . import path
from . import point
from typing import List

import logging
import gpxpy

from . import height_fetcher

logger = logging.getLogger(__file__)

def parse_gpx_file(gpx_raw_data : TextIOWrapper) -> path.Path_LV03:
    gpx : gpxpy.gpx = gpxpy.parse(gpx_raw_data)
    paths : List[path.Path_WGS84] = []
    for track in gpx.tracks:
        for segment in track.segments:
            points : List[point.Point_WGS84] = []
            for p in segment.points:
                points.append(point.Point_WGS84(p.latitude, p.longitude, p.elevation))
            paths.append(path.Path_WGS84(points))

    if len(paths) > 1:
        raise Exception('More than one track found')

    if len(paths) == 0:
        raise Exception('No track found')

    lv03_path = paths[0].to_LV03()
    lv03_path.route_name = gpx.name if gpx.name else ""
    if not lv03_path.has_elevation_for_all_points():
        lv03_path = height_fetcher.height_fetch_path(lv03_path)
    else:
        pass # all good, GPX has elevation data
    
    logger.debug("Loaded GPX file with " + str(len(lv03_path.points)) + " coordinates.")

    return lv03_path

def parse_kml_file(file_path : TextIOWrapper) -> path.Path_LV03:
    raw_data = file_path.read()

    # find <LineString> and </LineString>
    start_index = raw_data.find('<LineString>')
    end_index = raw_data.find('</LineString>')

    # check if <LineString> and </LineString> are found
    if start_index == -1 or end_index == -1:
        raise Exception('No <LineString> or </LineString> found')
    
    # remove <LineString> and </LineString>
    raw_data = raw_data[start_index+len('<LineString>'):end_index]

    # carve out contents of <coordinates>...</coordinates>
    start_index = raw_data.find('<coordinates>')
    end_index = raw_data.find('</coordinates>')
    
    # check if <coordinates> and </coordinates> are found
    if start_index == -1 or end_index == -1:
        raise Exception('No <coordinates> or </coordinates> found')
    
    # remove <coordinates> and </coordinates>
    raw_data = raw_data[start_index+len('<coordinates>'):end_index]

    coordinates = raw_data.split(' ')
    coordinates = [c.split(',') for c in coordinates]
    has_elevation = len(coordinates[0]) == 3

    logger.debug("Loaded KML file with " + str(len(coordinates)) + " coordinates.")
    
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
        path_lv03 = path.Path_WGS84(coordinates).to_LV03()
        path_lv03 = height_fetcher.height_fetch_path(path_lv03)
        return path_lv03

    else:
        c1 = float(coordinates[0][0])
        c2 = float(coordinates[0][1])
        if c1 < c2:
            # latitudes and longitudes are flipped
            coordinates = [point.Point_WGS84(float(c[1]), float(c[0]), float(c[2])) for c in coordinates]
        else:
            coordinates = [point.Point_WGS84(float(c[0]), float(c[1]), float(c[2])) for c in coordinates]
    return path.Path_LV03([p.to_LV03() for p in coordinates])