import argparse
import logging
import pathlib
import time

from automatic_walk_time_tables.generator_status import GeneratorStatus
from automatic_walk_time_tables.geo_processing.map_numbers import fetch_map_numbers
from automatic_walk_time_tables.map_downloader.create_map import MapCreator
from automatic_walk_time_tables.path_transformers.douglas_peucker_transformer import DouglasPeuckerTransformer
from automatic_walk_time_tables.path_transformers.equidistant_transfomer import EquidistantTransformer
from automatic_walk_time_tables.path_transformers.naming_transformer import NamingTransformer
from automatic_walk_time_tables.path_transformers.pois_transfomer import POIsTransformer
from automatic_walk_time_tables.utils import path
from automatic_walk_time_tables.utils.file_parser import GeoFileParser
from automatic_walk_time_tables.walk_time_table.walk_table import plot_elevation_profile, create_walk_table
from server_logging.status_handler import ExportStateLogger


class AutomatedWalkTableGenerator:

    def __init__(self, args: argparse.Namespace, uuid: str, options: dict, file_content: str = ''):

        self.args = args
        self.uuid = uuid
        self.__logger = logging.getLogger(__name__)

        for arg in vars(self.args):
            self.__logger.debug("  %s: %s", arg, getattr(self.args, arg))

        if 'file_type' not in options or options['file_type'] is None:
            raise Exception('No file ending provided.')

        if file_content is None:
            raise Exception('No GPX/KML file provided with the POST request.')

        geo_file_parser = GeoFileParser(fetch_elevation=False)
        self.__path = geo_file_parser.parse(file_content=file_content, extension=options['file_type'])

        self.__output_directory = args.output_directory
        pathlib.Path(self.__output_directory).mkdir(parents=True, exist_ok=True)

    def run(self):
        self.__log_runtime(self.__create_files, "Benötigte Zeit für Export")

        # Export successfully completed
        self.__logger.log(ExportStateLogger.REQUESTABLE,
                          'Export abgeschlossen, die Daten können heruntergeladen werden.',
                          {'uuid': self.uuid, 'status': GeneratorStatus.SUCCESS})

    def __create_files(self):
        gpx_rout_name = self.__path.route_name
        self.__logger.debug(str(self.__path))

        name = self.__output_directory + 'Route' if gpx_rout_name == "" else self.__output_directory + gpx_rout_name

        # calc POIs for the path
        pois_transformer = POIsTransformer(self.args.list_of_pois)
        pois: path.Path = pois_transformer.transform(self.__path)

        # calc points for walk-time table
        douglas_peucker_transformer = DouglasPeuckerTransformer(number_of_waypoints=21, pois=pois)
        selected_way_points: path.Path = self.__log_runtime(douglas_peucker_transformer.transform,
                                                            "Benötigte Zeit zum Berechnen der Marschzeittabelle",
                                                            self.__path)

        equidistant_transformer = EquidistantTransformer(equidistant_distance=1)
        equidistant_way_points: path.Path = equidistant_transformer.transform(self.__path)

        self.__logger.log(ExportStateLogger.REQUESTABLE, 'Route wurde berechnet.',
                          {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING,
                           'route': equidistant_way_points.to_polyline()})

        # name points of walk-time table
        if self.args.create_excel or self.args.create_map_pdfs:
            naming_fetcher = NamingTransformer()
            selected_way_points = naming_fetcher.transform(selected_way_points)

        if self.args.create_elevation_profile:
            self.__logger.debug('Boolean indicates that we should create the elevation profile.')
            self.__log_runtime(plot_elevation_profile, "Benötigte Zeit zum Zeichnen des Höhenprofils", self.__path,
                               selected_way_points, pois, file_name=name,
                               open_figure=self.args.open_figure, legend_position=self.args.legend_position)
            self.__logger.log(ExportStateLogger.REQUESTABLE, 'Höhenprofil wurde erstellt.',
                              {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

        if self.args.create_excel:
            # We use fetch map numbers only for the selected way points,
            # this is much faster that for every point in the original path. As the swiss_TML_api uses a tolerance
            # of 2_000m anyway the chance to miss a map number is very small.

            map_numbers = self.__log_runtime(fetch_map_numbers, "Benötigte Zeit um die Karten-Nummern zu berechnen",
                                             selected_way_points)
            self.__logger.debug("Input File Name: %s", name)
            self.__logger.debug("Map Numbers: %s", map_numbers)

            self.__logger.debug('Boolean indicates that we should create walk-time table as Excel file')
            self.__log_runtime(create_walk_table, "Benötigte Zeit zum Erstellen der Excel-Tabelle",
                               self.args.departure_time, self.args.velocity, selected_way_points,
                               route_name=gpx_rout_name,
                               file_name=name, creator_name=self.args.creator_name,
                               map_numbers=map_numbers)

            self.__logger.log(ExportStateLogger.REQUESTABLE, 'Marschzeittabelle wurde erstellt.',
                              {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

        if self.args.create_map_pdfs:
            self.__logger.debug('Boolean indicates that we should create map PDFs.')
            self.__logger.log(ExportStateLogger.REQUESTABLE, 'Karten werden erstellt...',
                              {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})
            map_creator = MapCreator(self.__path, self.uuid)
            self.__log_runtime(map_creator.plot_route_on_map,
                               "Benötigte Zeit zum Erstellen der Karten-PDFs",
                               selected_way_points,
                               pois=pois,
                               file_name=name,
                               map_scaling=self.args.map_scaling,
                               map_layers=list(map(lambda layer: layer.strip(), self.args.map_layers.split(','))),
                               print_api_base_url=self.args.print_api_base_url)

    def __log_runtime(self, function, log_string='Time used', *args, **kwargs, ):
        """
        Logs the time it takes to run the given function.
        """
        start = time.time()
        results = function(*args, **kwargs)
        self.__logger.log(ExportStateLogger.REQUESTABLE,
                          log_string + ': %ss' % round((time.time() - start), 2),
                          {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})
        return results
