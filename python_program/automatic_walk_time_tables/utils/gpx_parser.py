from io import TextIOWrapper
from . import path
from . import point
from typing import List

import gpxpy

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
        
        paths[0].route_name = gpx.name
        return paths[0].to_LV03()