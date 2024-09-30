import logging
import xml.etree.ElementTree as ET

import gpxpy

from . import path


def create_gpx_file(path: path.Path, way_points: path.Path):
    gpx_f = gpxpy.gpx.GPX()
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_segment = gpxpy.gpx.GPXTrackSegment()

    # this function is limited to 10000 track points
    LIMIT = 10_000
    if len(path.way_points) > LIMIT:
        logging.warning(
            f"Too many track points in path, this will result in unexpected behavior in the Swisstopo APP. "
            f"Limit is {LIMIT}, got {len(path.way_points)}"
        )

    for i, point in enumerate(path.way_points):
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        elevation = p84.h
        name = point.name

        # each track points must have the swisstopo:routepoint_id extension with a
        # unique id for each point
        track_point = gpxpy.gpx.GPXTrackPoint(lat, lon, elevation=elevation, name=name)
        routepoint_id = ET.Element("swisstopo:routepoint_id")
        routepoint_id.text = str(LIMIT) + str(i)
        track_point.extensions.append(routepoint_id)
        gpx_segment.points.append(track_point)

    gpx_track.segments.append(gpx_segment)
    gpx_f.tracks.append(gpx_track)

    accumulated_distance_before = 0

    for i, point in enumerate(way_points.way_points):
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        elevation = p84.h
        name = point.name

        # this should be a unique id for each waypoint
        gpx_extension_id = ET.Element("swisstopo:waypoint_id")
        gpx_extension_id.text = str(2 * LIMIT) + str(i)

        # this must be the ID of a track point at the same location
        gpx_extension_route_id = ET.Element("swisstopo:waypoint_routepoint_id")
        closest_track_point = path.get_closest_point(point.point)
        gpx_extension_route_id.text = str(LIMIT) + str(
            path.way_points.index(closest_track_point)
        )

        gpx_extension_control = ET.Element("swisstopo:waypoint_is_controlpoint")
        # 1 = for start or end point, 0 = for all other points
        gpx_extension_control.text = (
            "1" if i == 0 or i == len(way_points.way_points) - 1 else "0"
        )

        gpx_extension_meters = ET.Element("swisstopo:waypoint_meters_into_tour")
        meters = float(point.accumulated_distance)
        gpx_extension_meters.text = "{:.6f}".format(meters)

        gpx_extension_waypoint_stage_before = ET.Element(
            "swisstopo:waypoint_stage_before"
        )
        gpx_extension_waypoint_stage_before.attrib["distance"] = "{:.6f}".format(
            meters - accumulated_distance_before
        )
        gpx_extension_waypoint_stage_before.attrib["duration"] = "0"
        gpx_extension_waypoint_stage_before.attrib["ascent"] = "0"
        gpx_extension_waypoint_stage_before.attrib["descent"] = "0"
        accumulated_distance_before = meters

        wp = gpxpy.gpx.GPXWaypoint(lat, lon, elevation=elevation, name=name)
        wp.extensions.append(gpx_extension_id)
        wp.extensions.append(gpx_extension_route_id)
        wp.extensions.append(gpx_extension_control)
        wp.extensions.append(gpx_extension_meters)

        if i != 0:
            wp.extensions.append(gpx_extension_waypoint_stage_before)

        gpx_f.waypoints.append(wp)

    gpx_xml = gpx_f.to_xml()

    # we add the metadata manually as the gpxpy library does not support it
    # to add custom metadata

    route_name = path.route_name
    route_description = "Diese Datei wurde mit Cevi.Tools erstellt."

    if route_name == "":
        route_name = "Cevi.Tools - Marschzeittabelle"

    # show warning if route name is too long
    # according to the Swisstopo GPX schema, the route name should not exceed 25 characters,
    # or it will be truncated in the APP
    elif len(route_name) > 25:
        logging.warning("Route name is too long, will be truncated")

    meta_data = ET.Element("metadata")

    # we need to mark the route as a swisstopo tour in to enable named waypoints
    tour_type = ET.Element("swisstopo:tour_type")
    tour_type.text = "0"  # 0 = hiking, 1 = biking, 2 = mountain biking
    extensions = ET.Element("extensions")
    extensions.append(tour_type)
    meta_data.append(extensions)

    route_name_element = ET.Element("name")
    route_name_element.text = route_name
    meta_data.append(route_name_element)

    route_description_element = ET.Element("desc")
    route_description_element.text = route_description
    meta_data.append(route_description_element)

    # TODO: this is ugly
    gpx_xml = gpx_xml.replace(
        "</gpx>", ET.tostring(meta_data).decode("utf-8") + "</gpx>"
    )

    return gpx_xml
