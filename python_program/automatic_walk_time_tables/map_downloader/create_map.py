import json
import time
from pathlib import Path

import gpxpy
import requests

from .. import coord_transformation


def plot_route_on_map(raw_gpx_data: gpxpy.gpx,
                      way_points: [],
                      file_name: str,
                      open_figure: bool,
                      map_scaling: int,
                      layer: str = 'ch.swisstopo.pixelkarte-farbe',
                      print_api_base_url: str = 'localhost',
                      print_api_port: int = 8080,
                      print_api_protocol: str = 'http'):
    """

    Creates a map of the route and marking the selected way points on it.

    raw_gpx_data : raw data form imported GPX file
    way_points : selected way points of the  walk-time table
    tile_format_ext : Format of the tile, allowed values jpeg or png, default jpeg
    layer : Map layer, see https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml for options
    print_api_base_url : host of the mapfish instance, default localhost
    print_api_port : port for accessing mapfish, default 8080
    print_api_protocol : protocol used for accessing mapfish, default http

    """

    query_json = create_mapfish_query(layer, map_scaling, raw_gpx_data)

    base_url = "{}://{}:{}".format(print_api_protocol, print_api_base_url, print_api_port)
    url = '{}/print/default/report.pdf'.format(base_url)
    response_obj = requests.post(url, data=json.dumps(query_json))

    if response_obj.status_code != 200:
        raise Exception('Can not fetch map. Status Code: {}'.format(response_obj.status_code))

    response_json = json.loads(response_obj.content)

    pdf_status = requests.get(base_url + response_json['statusURL'])
    while pdf_status.status_code == 200 and json.loads(pdf_status.content)['status'] == 'running':
        time.sleep(0.5)
        pdf_status = requests.get(base_url + response_json['statusURL'])
        print(json.loads(pdf_status.content)['status'])

    if response_obj.status_code != 200 and json.loads(pdf_status.content)['status'] != 'finished':
        raise Exception('Can not fetch map. Status Code: {}'.format(response_obj.status_code))

    fetched_pdf = requests.get(base_url + response_json['downloadURL'])

    if response_obj.status_code != 200:
        raise Exception('Can not fetch map. Status Code: {}'.format(response_obj.status_code))

    with open('output/{}_map.pdf'.format(file_name), 'wb') as f:
        f.write(fetched_pdf.content)


def create_mapfish_query(layer, map_scaling, raw_gpx_data):
    """

    Returns the JSON-Object used for querying

    """

    path_coordinates = get_path_coordinates_as_list(raw_gpx_data)

    # load the default map matrices, used to inform mapfish about the available map scales and tile size
    with open(str(Path(__file__).resolve().parent) + '/default_map_matrices.json') as json_file:
        default_matrices = json.load(json_file)

    query_json = {
        "layout": "A4 landscape",
        "outputFormat": "pdf",
        "attributes": {
            "map": {
                "center": path_coordinates[0],
                "scale": map_scaling,
                "dpi": 400,
                "pdfA": True,
                "projection": "EPSG:2056",
                "rotation": 0,
                "layers": [
                    {
                        "geoJson": {
                            "type": "FeatureCollection",
                            "features": [
                                {
                                    "type": "Feature",
                                    "geometry": {
                                        "type": "LineString",
                                        "coordinates": path_coordinates
                                    },
                                    "properties": {
                                        "_ngeo_style": "1,2"
                                    },
                                    "id": 7772936
                                }
                            ]
                        },
                        "opacity": 1,
                        "style": {
                            "version": 2,
                            "[_ngeo_style = '1,2']": {
                                "symbolizers": [
                                    {
                                        "type": "line",
                                        "strokeColor": "#e30613",
                                        "strokeOpacity": 0.5,
                                        "strokeWidth": 2.5
                                    },
                                    {
                                        "type": "line",
                                        "strokeColor": "#e30613",
                                        "strokeOpacity": 0.75,
                                        "strokeWidth": .5
                                    }
                                ]
                            }
                        },
                        "type": "geojson",
                        "name": "selected track"
                    },
                    {
                        "baseURL": "https://wmts100.geo.admin.ch/1.0.0/{Layer}/{style}/{Time}/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.jpeg",
                        "dimensions": ["Time"],
                        "dimensionParams": {"Time": "current"},
                        "name": layer,
                        "imageFormat": "image/jpeg",
                        "layer": layer,
                        "matrixSet": "2056",
                        "opacity": 0.85,
                        "requestEncoding": "REST",
                        "matrices": default_matrices,
                        "style": "default",
                        "type": "WMTS",
                        "version": "1.0.0"
                    }
                ]
            }
        }
    }
    return query_json


def get_path_coordinates_as_list(raw_gpx_data):
    path_coordinates = []
    converter = coord_transformation.GPSConverter()
    for track in raw_gpx_data.tracks:
        for segment in track.segments:
            for point in segment.points:
                wgs84_point = [point.latitude, point.longitude, point.elevation]
                lv03_point = converter.WGS84toLV03(wgs84_point[0], wgs84_point[1], wgs84_point[2])
                path_coordinates.append([lv03_point[0] + 2_000_000, lv03_point[1] + 1_000_000])
    return path_coordinates
