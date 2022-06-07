import argparse
import logging
import pathlib
import time

from automatic_walk_time_tables.generator_status import GeneratorStatus
from automatic_walk_time_tables.geo_processing.find_walk_table_points import select_waypoints
from automatic_walk_time_tables.geo_processing.map_numbers import find_map_numbers
from automatic_walk_time_tables.map_downloader.create_map import MapCreator
from automatic_walk_time_tables.utils.file_parser import GeoFileParser
from automatic_walk_time_tables.walk_time_table.walk_table import plot_elevation_profile, create_walk_table
from server_logging.status_handler import ExportStateLogger


class AutomatedWalkTableGenerator:

    def __init__(self, args: argparse.Namespace, uuid: str = ''):

        self.args = args
        self.uuid = uuid
        self.logger = logging.getLogger(__name__)

        for arg in vars(self.args):
            self.logger.debug("  %s: %s", arg, getattr(self.args, arg))

        geo_file_parser = GeoFileParser()
        self.path_ = geo_file_parser.parse(self.args.file_name)

        self.output_directory = args.output_directory
        pathlib.Path(self.output_directory).mkdir(parents=True, exist_ok=True)

    def __log_runtime(self, function, log_string='Time used', *args, **kwargs, ):
        """
        Logs the time it takes to run the given function.
        """
        start = time.time()
        results = function(*args, **kwargs)
        self.logger.log(ExportStateLogger.REQUESTABLE,
                        log_string + ': %ss' % round((time.time() - start), 2),
                        {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})
        return results

    def run(self):
        self.__log_runtime(self.__create_files, "Time used for export")

        # Export successfully completed
        self.logger.log(ExportStateLogger.REQUESTABLE,
                        'Export abgeschlossen, die Daten können heruntergeladen werden.',
                        {'uuid': self.uuid, 'status': GeneratorStatus.SUCCESS})

    def __create_files(self):
        gpx_rout_name = self.path_.route_name
        self.logger.debug(str(self.path_))

        name = self.output_directory + 'Route' if gpx_rout_name == "" else self.output_directory + gpx_rout_name

        # calc Points for walk table
        # TODO: find the map numbers using the swiss_TML API instead of calling the Swisstopo API.
        # This could improve the performance as currently this function call takes around 5s to complete.
        map_numbers = self.__log_runtime(find_map_numbers, "Time used to find map numbers", self.path_)
        self.logger.debug("Input File Name: %s", name)
        self.logger.debug("Map Numbers: %s", map_numbers)

        if self.args.create_excel or self.args.create_map_pdfs or self.args.create_elevation_profile:

            # calc Points for walk table
            total_distance, temp_points, way_points = \
                self.__log_runtime(select_waypoints, "Time used to compute walk_time_table", self.path_)

            if self.args.create_elevation_profile:
                self.logger.debug('Boolean indicates that we should create the elevation profile.')
                # calc Points for walk table
                self.__log_runtime(plot_elevation_profile, "Time used to plot elevation profile excel", self.path_,
                                   way_points, temp_points, file_name=name,
                                   open_figure=self.args.open_figure)
                self.logger.log(ExportStateLogger.REQUESTABLE, 'Höhenprofil wurde erstellt.',
                                {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

            if self.args.create_excel:
                self.logger.debug('Boolean indicates that we should create walk-time table as Excel file')
                name_of_points = self.__log_runtime(create_walk_table, "Time used to create walk-time table as Excel",
                                                    self.args.departure_time, self.args.velocity, way_points,
                                                    total_distance, route_name=gpx_rout_name,
                                                    file_name=name, creator_name=self.args.creator_name,
                                                    map_numbers=map_numbers)

                self.logger.log(ExportStateLogger.REQUESTABLE, 'Marschzeittabelle wurde erstellt.',
                                {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

            else:
                name_of_points = [''] * len(way_points)

            if self.args.create_map_pdfs:
                self.logger.debug('Boolean indicates that we should create map PDFs.')
                map_creator = MapCreator(self.path_, self.uuid)
                self.__log_runtime(map_creator.plot_route_on_map,
                                   "Time used to create map PDFs",
                                   way_points,
                                   file_name=name,
                                   map_scaling=self.args.map_scaling,
                                   name_of_points=name_of_points,
                                   print_api_base_url=self.args.print_api_base_url)
