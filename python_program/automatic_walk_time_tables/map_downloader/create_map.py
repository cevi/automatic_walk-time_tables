import gpxpy
import json
import matplotlib.pyplot as plt
import numpy as np
import requests
import time
from matplotlib.patches import Rectangle
from pathlib import Path
from pyclustering.cluster.kmeans import kmeans, kmeans_visualizer
from pyclustering.utils.metric import type_metric, distance_metric

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

    map_centers = create_map_centers(map_scaling, raw_gpx_data)


    if len(map_centers) > 10:
        raise Exception("You should respect the faire use limit!")
        return

    for index, map_center in enumerate(map_centers):

        query_json = create_mapfish_query(layer, map_scaling, raw_gpx_data, map_center)

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

        with open('output/{}_{}_map.pdf'.format(file_name, index), 'wb') as f:
            f.write(fetched_pdf.content)


def create_mapfish_query(layer, map_scaling, raw_gpx_data, center):
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
                "center": center,
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


def GetSpacedElements(array, numElems=4):

    """
    Get numElems of an array, that are equally spaced based on index (not value).
    """

    indices = np.round(np.linspace(0, len(array) - 1, numElems)).astype(int)
    return list(np.array(array)[indices])


def create_map_centers(map_scaling: int, raw_gpx_data: gpxpy.gpx) -> []:
    """

    Calculates the map centers based on the approach discussed here:
    https://stackoverflow.com/questions/51946065/cover-a-polygonal-line-using-the-least-given-rectangles-while-keeping-her-contin

    """

    points = get_path_coordinates_as_list(raw_gpx_data)

    w = 6.5 / 25.0 * map_scaling
    h = 4.5 / 25.0 * map_scaling
    n = 0
    n_points = 200

    path_covered = False

    while not path_covered:

        n = n + 1
        points_for_clustering = GetSpacedElements(points, n_points)

        user_function = lambda point1, point2: max(abs(point1[0] - point2[0]) / (w / 2),
                                                   abs(point1[1] - point2[1]) / (h / 2))
        metric = distance_metric(type_metric.USER_DEFINED, func=user_function)

        # create K-Means algorithm with specific distance metric
        start_centers = GetSpacedElements(points_for_clustering, n)
        kmeans_instance = kmeans(points_for_clustering, start_centers, metric=metric)

        # Run cluster analysis and obtain results.
        kmeans_instance.process()
        clusters = kmeans_instance.get_clusters()
        final_centers = kmeans_instance.get_centers()

        path_covered = True

        for i, pkt in enumerate(points):

            point_covered = False
            for center in final_centers:
                d = user_function(center, pkt)
                if d < 1:
                    point_covered = True
                    break

            if not point_covered:
                path_covered = False
                break

        if n >= 25:
            path_covered = True

    return final_centers


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
