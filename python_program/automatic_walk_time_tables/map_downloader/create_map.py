import json
import logging
import os
import time
from pathlib import Path
from typing import List

import numpy as np
import requests
from pyclustering.cluster.kmeans import kmeans
from pyclustering.utils.metric import type_metric, distance_metric

from automatic_walk_time_tables.generator_status import GeneratorStatus
from automatic_walk_time_tables.geo_processing import gpx_utils
from automatic_walk_time_tables.utils import path
from automatic_walk_time_tables.utils.point import Point_LV03, Point_LV95
from automatic_walk_time_tables.utils.way_point import WayPoint
from server_logging.status_handler import ExportStateLogger


def GetSpacedElements(array, numElems=4):
    """
    Get numElems of an array, that are equally spaced based on index (not value).
    """

    indices = np.round(np.linspace(0, len(array) - 1, numElems)).astype(int)
    return list(np.array(array)[indices])


class MapCreator:
    A4_HEIGHT_FACTOR = 4.5 / 25.0
    """
    Used to calculate the size of the map printed on A4 at certain scale:
    `A4_HEIGHT_FACTOR * map_scale` gives you the number of km displayed on one A4 paper.
    """

    A4_WIDTH_FACTOR = 6.5 / 25.0
    """
    Used to calculate the size of the map printed on A4 at certain scale:
    `A4_WIDTH_FACTOR * map_scale` gives you the number of km displayed on one A4 paper.
    """

    def __init__(self, path_: path.Path, uuid: str):
        self.logger = logging.getLogger(__name__)
        self.path_ = path_
        self.uuid = uuid

    def auto_select_map_scaling(self) -> int:
        """

        Automatically selects a suitable map scaling such that the path can be printed
        onto a single A4 paper. While keeping the scaling is as small as possible. The
        scaling gets chosen out of a list of common map scaling: 1:10'000, 1:25'000,
        1:50'000, 1:100'000, or 1:200'000.

        """

        lower_left, upper_right = gpx_utils.calc_perimeter(self.path_)

        # List of most common map scales
        common_map_scales = [10_000, 25_000, 50_000, 100_000, 200_000]

        for map_scale in common_map_scales:
            if self.A4_HEIGHT_FACTOR * map_scale >= upper_right.lon - lower_left.lon and \
                    self.A4_WIDTH_FACTOR * map_scale >= lower_left.lon - upper_right.lan:
                break

        self.logger.info(f'Map scaling automatically set to 1:{map_scale}')
        return map_scale

    def plot_route_on_map(self,
                          way_points: List[WayPoint],
                          file_name: str,
                          map_scaling: int,
                          name_of_points: List[str],
                          layer: str = 'ch.swisstopo.pixelkarte-farbe',
                          print_api_base_url: str = 'localhost',
                          print_api_port: int = 8080,
                          print_api_protocol: str = 'http'):
        """

        Creates a map of the route and marking the selected way points on it.

        way_points : selected way points of the  walk-time table
        tile_format_ext : Format of the tile, allowed values jpeg or png, default jpeg
        layer : Map layer, see https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml for options
        print_api_base_url : host of the mapfish instance, default localhost
        print_api_port : port for accessing mapfish, default 8080
        print_api_protocol : protocol used for accessing mapfish, default http

        """

        if map_scaling is None:
            map_scaling = self.auto_select_map_scaling()

        map_centers = self.create_map_centers(map_scaling)

        if len(map_centers) > 10:
            self.logger.log(ExportStateLogger.REQUESTABLE,
                            f"Eine Anfrage würde {len(map_centers)} PDFs generieren, wir haben die Anzahl aber auf 10 beschränkt. Bitte vergrössere deinen Kartenmassstab und probiere es erneut.",
                            {'uuid': self.uuid, 'status': GeneratorStatus.ERROR})
            logging.error(f'Too many map centers (exceeding faire use limit).')
            if (self.logger.getEffectiveLevel() == logging.DEBUG):
                raise Exception("You should respect the faire use limit!")
            else:
                exit(1)

        for index, map_center in enumerate(map_centers):

            query_json = self.create_mapfish_query(layer, map_scaling, map_center, way_points, name_of_points)

            base_url = "{}://{}:{}".format(print_api_protocol, print_api_base_url, print_api_port)
            url = '{}/print/default/report.pdf'.format(base_url)

            self.logger.debug("Posting to mapfish: " + url)

            try:
                response_obj = requests.post(url, data=json.dumps(query_json))
            except requests.exceptions.ConnectionError:
                self.logger.error("Could not connect to mapfish server. Is the server running?")
                if (self.logger.getEffectiveLevel() == logging.DEBUG):
                    raise Exception("Could not connect to mapfish server. Is the server running?")
                else:
                    exit(1)

            if response_obj.status_code != 200:
                logging.error("Error while posting to mapfish: " + str(response_obj.status_code))
                if (self.logger.getEffectiveLevel() == logging.DEBUG):
                    raise Exception('Can not fetch map. Status Code: {}'.format(response_obj.status_code))
                else:
                    exit(1)

            response_json = json.loads(response_obj.content)

            pdf_status = requests.get(base_url + response_json['statusURL'])
            loop_idx = 0
            while pdf_status.status_code == 200 and not json.loads(pdf_status.content)['done']:
                time.sleep(0.5)
                pdf_status = requests.get(base_url + response_json['statusURL'])
                self.logger.debug(f"Waiting for PDF {index + 1} out of {len(map_centers)}. ({loop_idx * 0.5}s)")
                loop_idx += 1
                self.logger.info(
                    f"PDF Status: {json.loads(pdf_status.content)['done']}: {json.loads(pdf_status.content)['status']}")

            self.logger.info(
                f"PDF Status: {json.loads(pdf_status.content)['done']}: {json.loads(pdf_status.content)['status']}")

            self.logger.info(f"Received PDF {index + 1} out of {len(map_centers)}.")
            self.logger.log(ExportStateLogger.REQUESTABLE,
                            f"Karte {index + 1} von insgesamt {len(map_centers)} wurde erstellt.",
                            {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

            if pdf_status.status_code != 200 or json.loads(pdf_status.content)['status'] != 'finished':
                logging.error("Can not fetch the map: " + str(response_obj.status_code))
                if (self.logger.getEffectiveLevel() == logging.DEBUG):
                    raise Exception('Can not fetch map. Status Code: {}'.format(response_obj.status_code))
                else:
                    exit(1)

            # Wait for the PDF to be ready
            time.sleep(0.5)

            fetched_pdf = requests.get(base_url + response_json['downloadURL'])

            if response_obj.status_code != 200:
                logging.error("Error fetching the map: " + str(response_obj.status_code))
                if (self.logger.getEffectiveLevel() == logging.DEBUG):
                    raise Exception('Can not fetch map. Status Code: {}'.format(response_obj.status_code))
                else:
                    exit(1)

            # Check if output directory exists, if not, create it.
            if (not os.path.exists('output')):
                os.mkdir('output')

            with open('{}_{}_map.pdf'.format(file_name, index), 'wb') as f:
                f.write(fetched_pdf.content)

            self.logger.info("Saved map to {}_{}_map.pdf".format(file_name, index))

    def create_mapfish_query(self, layer, map_scaling, center,
                             way_points: List[WayPoint],
                             name_of_points):
        """

        Returns the JSON-Object used for querying

        """

        path_coordinates = []
        for pt in self.path_.points:
            pt_lv95: Point_LV95 = pt.to_LV95()
            path_coordinates.append([pt_lv95.lat, pt_lv95.lon])  # convert to LV95

        # load the default map matrices, used to inform mapfish about the available map scales and tile size
        with open(str(Path(__file__).resolve().parent) + '/default_map_matrices.json') as json_file:
            default_matrices = json.load(json_file)

        path_layer = {
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
                            "strokeColor": "#E88615",
                            "strokeOpacity": 0.5,
                            "strokeWidth": 2.5
                        },
                        {
                            "type": "line",
                            "strokeColor": "#E88615",
                            "strokeOpacity": 0.75,
                            "strokeWidth": .5
                        }
                    ]
                }
            },
            "type": "geojson",
            "name": "selected track"
        }
        map_layer = {
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

        point_layers = []
        for i, point in enumerate(way_points):
            lv95 = point.point.to_LV95()

            # TODO: currently, we convert to LV95, is there a way to stick to LV03 also for mapfish?

            point_layer = {
                "geoJson": {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": [lv95.lat, lv95.lon]
                            },
                            "properties": {
                                "_ngeo_style": "1"
                            },
                            "id": 1596274
                        }
                    ]
                },
                "opacity": 1,
                "style": {
                    "version": 2,
                    "[_ngeo_style = '1']": {
                        "symbolizers": [
                            {
                                "type": "point",
                                "fillColor": "#FF0000",
                                "fillOpacity": 0,
                                "rotation": "30",

                                "graphicName": "circle",
                                "graphicOpacity": 0.4,
                                "pointRadius": 5,

                                "strokeColor": "#e30613",
                                "strokeOpacity": 1,
                                "strokeWidth": 2,
                                "strokeLinecap": "round",
                                "strokeLinejoin": "round",
                            },
                            {
                                "type": "text",
                                "fontColor": "#e30613",
                                "fontFamily": "sans-serif",
                                "fontSize": "8px",
                                "fontStyle": "normal",
                                "haloColor": "#ffffff",
                                "haloOpacity": "0.5",
                                "haloRadius": ".5",
                                "label": name_of_points[i],  # TODO: read point name from point
                                "fillColor": "#FF0000",
                                "fillOpacity": 0,
                                "labelAlign": "cm",
                                "labelRotation": "0",
                                "labelXOffset": "0",
                                "labelYOffset": "-12"
                            }
                        ]
                    }
                },
                "type": "geojson",
                "name": "selected track pois"
            }
            point_layers.append(point_layer)

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
                    "layers": point_layers + [path_layer, map_layer]
                }
            }
        }

        return query_json

    def create_map_centers(self, map_scaling: int) -> List[np.array]:
        """

        Calculates the map centers based on the approach discussed here:
        https://stackoverflow.com/questions/51946065/cover-a-polygonal-line-using-the-least-given-rectangles-while-keeping-her-contin

        """

        w = self.A4_WIDTH_FACTOR * map_scaling
        h = self.A4_HEIGHT_FACTOR * map_scaling
        n = 0  # number of A4 pages
        n_points = 200

        path_covered = False

        points_as_array = []
        for pt in self.path_.points:
            pt95 = pt.to_LV95()
            points_as_array.append([pt95.lat, pt95.lon])

        while not path_covered:
            n = n + 1
            points_for_clustering = GetSpacedElements(points_as_array, n_points)

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

            self.logger.debug("Number of clusters: {}".format(len(clusters)))

            path_covered = True

            for pkt in points_as_array:

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
