from io import TextIOWrapper
from . import path
from . import point
from typing import List

import gpxpy
import xml.etree.ElementTree as ET

class GPXParser:
    def __init__(self, gpx_raw_data : TextIOWrapper):
        self.gpx_raw_data = gpx_raw_data

    def parse(self) -> path.Path_LV03:
        gpx : gpxpy.gpx = gpxpy.parse(self.gpx_raw_data)
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

        if not paths[0].has_elevation_for_all_points():
            raise Exception('No elevation data available. NOT IMPLEMENTED YET')
        else:
            pass # all good, GPX has elevation data
        
        paths[0].route_name = gpx.name
        return paths[0].to_LV03()

class KMLParser:
    def __init__(self, file_path : TextIOWrapper):
        self.file_path = file_path

    def parse(self) -> path.Path_LV03:
        tree = ET.parse(self.file_path)
        root = tree.getroot()

        if not 'kml' in root.tag:
            raise Exception('Root tag is not kml, but ' + root.tag)
        
        if not 'Document' in root[0].tag:
            raise Exception('First tag is not Document, but ' + root[0].tag)
        
        if not 'Placemark' in root[0][1].tag:
            raise Exception('Second Document tag is not Placemark, but ' + root[0][1].tag)
        
        if not 'LineString' in root[0][1][3].tag:
            raise Exception('First Placemark tag is not LineString, but ' + root[0][1][3].tag)
        
        # get the LineString
        coord_tag = root[0][1][3][2]
        if not 'coordinates' in coord_tag.tag:
            raise Exception('LineString tag is not coordinates, but ' + coord_tag.tag)
        
        # get the coordinates
        coordinates = coord_tag.text
        coordinates = coordinates.split(' ')
        coordinates = [c.split(',') for c in coordinates]
        coordinates = [[float(c[0]), float(c[1])] for c in coordinates]
        has_elevation = len(coordinates[0]) == 3
        if not has_elevation:
            coordinates = [point.Point_WGS84(c[0], c[1]) for c in coordinates]
            raise Exception('No elevation data available. NOT IMPLEMENTED YET')
        else:
            coordinates = [point.Point_WGS84(c[0], c[1], c[2]) for c in coordinates]
        return path.Path_LV03([p.to_LV03() for p in coordinates])