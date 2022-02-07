import argparse
import logging
import pathlib

import gpxpy

from automatic_walk_time_tables.generator_status import GeneratorStatus
from automatic_walk_time_tables.geo_processing.find_walk_table_points import select_waypoints
from automatic_walk_time_tables.geo_processing.map_numbers import find_map_numbers
from automatic_walk_time_tables.map_downloader.create_map import MapCreator
from automatic_walk_time_tables.walk_time_table.walk_table import plot_elevation_profile, create_walk_table
from status_handler import ExportStateLogger


class AutomatedWalkTableGenerator:

    def __init__(self, args: argparse.Namespace, uuid: str = ''):

        self.args = args
        self.uuid = uuid
        self.logger = logging.getLogger(__name__)

        for arg in vars(self.args):
            self.logger.debug("  %s: %s", arg, getattr(self.args, arg))

        gpx_file = open(self.args.gpx_file_name, 'r')
        self.logger.debug("Reading %s", self.args.gpx_file_name)

        raise Exception('Functionality not yet implemented!')

        # TODO: Parse GPX file or KML file
        # TODO: Store them in a new Route Object instead of the raw GPX file format!
        self.raw_gpx_data = gpxpy.parse(gpx_file)

        self.output_directory = args.output_directory
        pathlib.Path(self.output_directory).mkdir(parents=True, exist_ok=True)

    def run(self):
        gpx_rout_name = self.raw_gpx_data.name
        name = self.output_directory + 'Route' if gpx_rout_name is None else self.output_directory + gpx_rout_name
        map_numbers = find_map_numbers(self.raw_gpx_data)  # map numbers and their names as a single string

        self.logger.debug("GPX Name: %s", name)
        self.logger.debug("Map Numbers: %s", map_numbers)

        if self.args.create_excel or self.args.create_map_pdfs or self.args.create_elevation_profile:

            # calc Points for walk table
            total_distance, temp_points, way_points = select_waypoints(self.raw_gpx_data)

            if self.args.create_elevation_profile:
                self.logger.debug('Boolean indicates that we should create the elevation profile.')
                plot_elevation_profile(self.raw_gpx_data, way_points, temp_points, file_name=name,
                                       open_figure=self.args.open_figure)
                self.logger.log(ExportStateLogger.REQUESTABLE, 'Höhenprofil wurde erstellt.',
                                {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

            if self.args.create_excel:
                self.logger.debug('Boolean indicates that we should create walk-time table as Excel file')
                name_of_points = create_walk_table(self.args.departure_time, self.args.velocity, way_points,
                                                   total_distance, route_name=gpx_rout_name,
                                                   file_name=name, creator_name=self.args.creator_name,
                                                   map_numbers=map_numbers)
                self.logger.log(ExportStateLogger.REQUESTABLE, 'Marschzeittabelle wurde erstellt.',
                                {'uuid': self.uuid, 'status': GeneratorStatus.RUNNING})

            else:
                name_of_points = [''] * len(way_points)

            if self.args.create_map_pdfs:
                self.logger.debug('Boolean indicates that we should create map PDFs.')
                map_creator = MapCreator(self.raw_gpx_data, self.uuid)
                map_creator.plot_route_on_map(way_points,
                                              file_name=name,
                                              map_scaling=self.args.map_scaling,
                                              name_of_points=name_of_points,
                                              print_api_base_url=self.args.print_api_base_url)

        # Export successfully completed
        self.logger.log(ExportStateLogger.REQUESTABLE,
                        'Export abgeschlossen, die Daten können heruntergeladen werden.',
                        {'uuid': self.uuid, 'status': GeneratorStatus.SUCCESS})
