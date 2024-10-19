import logging
import xml.etree.ElementTree as ET

import re
import os
import gpxpy
from gpxpy.gpx import GPX
import requests

from automatic_walk_time_tables.utils import path


def fetch_data_for_uuid(uuid):
    """
    Fetches the data for the given UUID from the store API.
    :param uuid: The UUID of the data to fetch
    :return: The data for the given UUID or None if the data is not available
    """

    r = requests.post(os.environ["STORE_API_URL"] + "/retrieve", json={"uuid": uuid})
    if r.status_code == 200:
        return r.json()

    return None


def create_gpx_file(_path: path.Path, _way_points: path.Path):
    """
    Create a GPX file from a path and waypoints.

    :param _path: The path object containing the route
    :param _way_points: The path object containing the waypoints the user wants to have along the path

    :return: The GPX file as a string
    """

    gpx_f = gpxpy.gpx.GPX()

    add_track_points(_path, gpx_f)
    add_waypoints(_path, _way_points, gpx_f)

    gpx_xml: str = gpx_f.to_xml()
    gpx_xml = add_metadata_to_gpx_str(_path, gpx_xml)
    return gpx_xml


def add_metadata_to_gpx_str(_path: path.Path, gpx_xml: str):
    """
    Add metadata to the GPX file (including route name, description, and swisstopo tour type)

    We have to add the metadata using string manipulation, because gpxpy does not support
    the swisstopo extensions on the metadata tag.

    :param _path: The path object containing the route name and description
    :param gpx_xml: The GPX file as a string
    :return: The GPX file with the metadata added
    """

    meta_data = ET.Element("metadata")

    ##########################
    # Add Tour Name and Description
    ##########################

    route_name = _path.route_name
    route_description = "Diese Datei wurde mit Cevi.Tools erstellt."

    # check if the route name is empty or too long
    if route_name == "":
        route_name = "Cevi.Tools - Marschzeittabelle"
    elif len(route_name) > 20:
        logging.warning("Route name is too long, will be truncated")

    # add date to route name
    route_name = f"{route_name} - Cevi.Tools"

    route_name_element = ET.Element("name")
    route_name_element.text = route_name
    meta_data.append(route_name_element)

    route_description_element = ET.Element("desc")
    route_description_element.text = route_description
    meta_data.append(route_description_element)

    ##########################
    # Add Swisstopo Tour Type
    #
    # we need to mark the route as a swisstopo tour in to enable
    # named waypoints: 0 = hiking, 1 = biking, 2 = mountain biking
    ##########################

    tour_type = ET.Element("swisstopo:tour_type")
    tour_type.text = "0"

    extensions = ET.Element("extensions")
    extensions.append(tour_type)
    meta_data.append(extensions)

    encoded_metadata = ET.tostring(meta_data).decode("utf-8")
    gpx_xml = gpx_xml.replace("</gpx>", f"{encoded_metadata}</gpx>")

    # minify the xml string and replace any spaces between tags
    return minify_xml(gpx_xml.replace("\n", ""))


def minify_xml(xml_content):
    # Remove line breaks, tabs, and multiple spaces
    minified_xml = re.sub(r">\s+<", "><", xml_content)  # Remove spaces between tags
    minified_xml = re.sub(
        r"\s+", " ", minified_xml
    ).strip()  # Collapse all whitespace inside tags
    return minified_xml


def add_track_points(_path: path.Path, gpx_f: GPX):
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_segment = gpxpy.gpx.GPXTrackSegment()

    for i, point in enumerate(_path.way_points):
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        elevation = p84.h
        name = point.name

        # each track points must have the swisstopo:routepoint_id extension with a
        # unique id for each point
        track_point = gpxpy.gpx.GPXTrackPoint(lat, lon, elevation=elevation)
        routepoint_id = ET.Element("swisstopo:routepoint_id")
        routepoint_id.text = f"1{i:08d}"
        track_point.extensions.append(routepoint_id)
        gpx_segment.points.append(track_point)
    gpx_track.segments.append(gpx_segment)
    gpx_f.tracks.append(gpx_track)


def add_waypoints(_path: path.Path, _way_points: path.Path, gpx_f: GPX):

    accumulated_distance = 0
    for i, point in enumerate(_way_points.way_points):
        p84 = point.point.to_WGS84()
        lat = p84.lat
        lon = p84.lon
        elevation = p84.h
        name = point.name

        # this should be a unique id for each waypoint
        gpx_extension_id = ET.Element("swisstopo:waypoint_id")
        gpx_extension_id.text = f"2{i:08d}"

        # this must be the ID of a track point at the same location
        gpx_extension_route_id = ET.Element("swisstopo:waypoint_routepoint_id")
        closest_track_point = _path.get_closest_point(point.point)
        gpx_extension_route_id.text = (
            f"1{_path.way_points.index(closest_track_point):08d}"
        )

        gpx_extension_control = ET.Element("swisstopo:waypoint_is_controlpoint")
        # 1 = for start or end point, 0 = for all other points
        gpx_extension_control.text = (
            "1" if i == 0 or i == len(_way_points.way_points) - 1 else "0"
        )

        gpx_extension_meters = ET.Element("swisstopo:waypoint_meters_into_tour")
        distance = float(point.accumulated_distance)
        gpx_extension_meters.text = "{:.6f}".format(distance)

        gpx_extension_waypoint_stage_before = ET.Element(
            "swisstopo:waypoint_stage_before"
        )
        gpx_extension_waypoint_stage_before.attrib["distance"] = "{:.6f}".format(
            distance - accumulated_distance
        )
        gpx_extension_waypoint_stage_before.attrib["duration"] = (
            "0"  # calculated by the app
        )
        gpx_extension_waypoint_stage_before.attrib["ascent"] = (
            "0"  # calculated by the app
        )
        gpx_extension_waypoint_stage_before.attrib["descent"] = (
            "0"  # calculated by the app
        )
        accumulated_distance = distance

        wp = gpxpy.gpx.GPXWaypoint(lat, lon, elevation=elevation, name=name)
        wp.extensions.append(gpx_extension_id)
        wp.extensions.append(gpx_extension_route_id)
        wp.extensions.append(gpx_extension_control)
        wp.extensions.append(gpx_extension_meters)

        # we don't need this extension for the first waypoint
        if i != 0:
            wp.extensions.append(gpx_extension_waypoint_stage_before)

        gpx_f.waypoints.append(wp)
