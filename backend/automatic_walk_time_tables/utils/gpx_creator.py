import gpxpy
from . import path
from . import point
from . import way_point
from typing import List
from xml.etree import ElementTree


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
        name = point.name
        gpx_segment.points.append(
            gpxpy.gpx.GPXTrackPoint(lat, lon, elevation=elevation, name=name)
        )

    gpx_track.segments.append(gpx_segment)
    gpx_f.tracks.append(gpx_track)

    for i,point in enumerate(pois.way_points):
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        elevation = p84.h
        name = point.name

        gpx_extension_id = ElementTree.fromstring(f"<swisstopo:waypoint_id>{i}</swisstopo:waypoint_id>")
        gpx_extension_route_id = ElementTree.fromstring(f"<swisstopo:waypoint_routepoint_id>{10000+i}</swisstopo:waypoint_routepoint_id>")

        control = 0
        if i == 0 or i == len(pois.way_points) -1:
            control = 1

        meters = float(point.accumulated_distance)

        gpx_extension_control = ElementTree.fromstring(f"<swisstopo:waypoint_is_controlpoint>{control}</swisstopo:waypoint_is_controlpoint>")
        gpx_extension_meters = ElementTree.fromstring(f"<swisstopo:waypoint_meters_into_tour>{meters}</swisstopo:waypoint_meters_into_tour>")
        
        wp = gpxpy.gpx.GPXWaypoint(lat, lon, elevation=elevation, name=name)

        wp.extensions.append(gpx_extension_id)
        wp.extensions.append(gpx_extension_route_id)
        wp.extensions.append(gpx_extension_control)

        gpx_f.waypoints.append(wp)

    return gpx_f.to_xml()
