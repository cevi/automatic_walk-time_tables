from typing import List

import grequests
import json
import numpy as np
import gpxpy

from . import coord_transformation


def is_in_bbox(bbox : List[float], coord_lv03):
    """ 
    Checks if a given GPX point in LV03 is inside a bounding box (given in LV95 coordinates).
    """
    # attention: bbox is in lv95, so add 2'000'000 to x and 1'000'000 to y.
    lv95x = coord_lv03[0] + 2000000
    lv95y = coord_lv03[1] + 1000000
    return bbox[0] < lv95x < bbox[2] and bbox[1] < lv95y < bbox[3]

def get_lv95(gpx_point):
    """ 
    Converts a GPX point into a LV95 point.
    """
    converter = coord_transformation.GPSConverter()
    wgs84_point = [gpx_point.latitude, gpx_point.longitude, gpx_point.elevation]
    lv03_point = np.round(converter.WGS84toLV03(wgs84_point[0], wgs84_point[1], wgs84_point[2]))
    lv95x = lv03_point[0] + 2000000
    lv95y = lv03_point[1] + 1000000
    return lv95x, lv95y

def sort_maps(s):
    """
    Carves out the LK number and returns it as an integer
    This can be used to sort a list of map names.
    """
    return int(s.split("(")[1].split(")")[0].split("LK ")[1])

def find_map_numbers(raw_gpx_data : gpxpy.gpx):
    """
    Gets the Landeskarten-numbers around the start point of the tour. Then checks for each point, if it is inside one of the maps.
    If so, the card will be added and finally all cards are returned as a string sorted by number ascending.
    """
    base_url = "https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometryFormat=geojson&geometryType=esriGeometryPoint&lang=de&layers=all:ch.swisstopo.geologie-geologischer_atlas.metadata&limit=50&returnGeometry=true&sr=2056&tolerance=100&"

    # get lv95 coordinates for the start point
    start_point = get_lv95(raw_gpx_data.tracks[0].segments[0].points[0])
    
    # Now we get all Landeskarte numbers from the API for the maps around start and end.
    # This means 1 request, which is below the fair use limit.
    url = base_url + f"geometry={start_point[0]},{start_point[1]}&imageDisplay=1283,937,96&mapExtent=2400000,1000000,2900000,1300000"

    r = (grequests.get(url),)
    results = grequests.map(r)

    all_maps = []
    for result in results:
        data = json.loads(result.content)
        for map in data["results"]:
            all_maps.append([map["properties"]["name_de"], map["bbox"]])

    converter = coord_transformation.GPSConverter()
    needed_maps = set()
    for track in raw_gpx_data.tracks:
        for segment in track.segments:
            for point in segment.points:
                wgs84_point = [point.latitude, point.longitude, point.elevation]
                lv03_point = np.round(converter.WGS84toLV03(wgs84_point[0], wgs84_point[1], wgs84_point[2]))
                
                for name,bbox in all_maps:
                    if(is_in_bbox(bbox, lv03_point)):
                        needed_maps.add(name)
                        break

    maps_list = list(needed_maps)
    return ",".join(sorted(maps_list, key=sort_maps))
