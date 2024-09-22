import gpxpy
from . import path
from . import point
from . import way_point
from typing import List


# TODO: also add waypoints?
def create_gpx_file(path: path.Path, pois: path.Path):
    gpx_f = gpxpy.gpx.GPX()
    gpx_f.name = path.route_name

    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_segment = gpxpy.gpx.GPXTrackSegment()

    for point in path.way_points:
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        elevation = p84.h
        gpx_segment.points.append(
            gpxpy.gpx.GPXTrackPoint(lat, lon, elevation=elevation)
        )

    gpx_track.segments.append(gpx_segment)
    gpx_f.tracks.append(gpx_track)

    for point in pois.way_points:
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        gpx_f.waypoints.append(gpxpy.gpx.GPXWaypoint(lat, lon))

    return gpx_f.to_xml()
