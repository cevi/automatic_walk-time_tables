# TODO: refactoring: move imports back up again, once every file contains only classes

# Set up logging
from automatic_walk_time_tables.log_helper import Formatter
import logging

# Change this line to enable debug log messages:
logging.root.setLevel(logging.INFO)
# Set up the root handler
root_handler = logging.StreamHandler()
root_handler.setFormatter(Formatter())
logging.root.addHandler(root_handler)

import argparse

from datetime import datetime

import gpxpy.gpx

from automatic_walk_time_tables.find_walk_table_points import select_waypoints
from automatic_walk_time_tables.map_downloader.create_map import MapCreator
from automatic_walk_time_tables.map_numbers import find_map_numbers
from automatic_walk_time_tables.walk_table import plot_elevation_profile, create_walk_table

class AutomatedWalkTableGenerator:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.logger = logging.getLogger(__name__)

        self.logger.debug("Arguments:")
        for arg in vars(self.args):
            self.logger.debug("  %s: %s", arg, getattr(self.args, arg))
        
        gpx_file = open(self.args.gpx_file_name, 'r')
        self.logger.debug("Reading %s", self.args.gpx_file_name)
        self.raw_gpx_data = gpxpy.parse(gpx_file)

    def run(self):
        name = self.raw_gpx_data.name
        map_numbers = find_map_numbers(self.raw_gpx_data) # map numbers and their names as a single string

        self.logger.debug("GPX Name: %s", name)
        self.logger.debug("Map Numbers: %s", map_numbers)

        if self.args.create_excel or self.args.create_map_pdfs or self.args.create_elevation_profile:

            # calc Points for walk table
            total_distance, temp_points, way_points = select_waypoints(self.raw_gpx_data)

            if self.args.create_elevation_profile:
                self.logger.debug('Boolean indicates that we should create the elevation profile.')
                plot_elevation_profile(self.raw_gpx_data, way_points, temp_points, file_name=name, open_figure=self.args.open_figure)

            if self.args.create_excel:
                self.logger.debug('Boolean indicates that we should create walk-time table as Excel file')
                name_of_points = create_walk_table(self.args.departure_time, self.args.velocity, way_points, total_distance,
                                                file_name=name, creator_name=self.args.creator_name, map_numbers=map_numbers)
            else:
                name_of_points = [''] * len(way_points)

            if self.args.create_map_pdfs:
                self.logger.debug('Boolean indicates that we should create map PDFs.')
                map_creator = MapCreator(self.raw_gpx_data)
                map_creator.plot_route_on_map(way_points, file_name=name, map_scaling=self.args.map_scaling,
                                name_of_points=name_of_points)

def str2bool(v):
    if isinstance(v, bool):
        return v
    if v.lower() in ('yes', 'true', 't', 'y', '1', 'j', 'ja'):
        return True
    elif v.lower() in ('no', 'false', 'f', 'n', '0', 'nein'):
        return False
    else:
        return False

if __name__ == "__main__":
    # Initialize parser
    parser = argparse.ArgumentParser(
        description='Automatically creates a walk-time table from an exported track from Swisstopo-App, '
                    'SchweizMobil, or form an arbitrary GPX-file')

    # Adding arguments
    parser.add_argument('-gfn', '--gpx-file-name', type=str, metavar='<file_path>', required=True,
                        help='Name and path to the GPX file default value.')
    parser.add_argument('-v', '--velocity', type=float, default=3.75, metavar='<speed>',
                        help='Float. Speed in km/h on which the calculation is based, default 3.75 km/h.')
    parser.add_argument('-s', '--map-scaling', type=int, metavar='<scale>',
                        help='Integer. Scaling of the created map (e.g. 10000 for scaling of 1:10\'000), if not '
                             'specified the scaling will be automatically chosen.')
    parser.add_argument('-t', '--departure-time', type=lambda s: datetime.fromisoformat(s), metavar='<time>',
                        default=datetime(year=2021, month=8, day=16, hour=9, minute=00),
                        help='Departure date in ISO-format, i.g. 2011-11-04T00:05:23. Default 2021-08-16T09:00:00.')
    parser.add_argument('-n', '--creator-name', type=str, metavar='<name>',
                        help='Name of you, the creator of this route. If not specified, it will be empty.', default='')

    # Enabling / Disabling Features
    parser.add_argument('--create-map-pdfs', default=True, type=str2bool,
                        help='Enable/Disable export as PDF. Require a running MapFish docker container. Enabled as default (True).')
    parser.add_argument('--create-excel', default=True, type=str2bool,
                        help='Enable/Disable creation of the walk-time table as excel. Enabled as default (True).')
    parser.add_argument('--create-elevation-profile', default=True, type=str2bool,
                        help='Enable/Disable creation of the elevation profile as PNG. Enabled as default (True).')
    parser.add_argument('--open-figure', default=False, type=str2bool,
                        help='If this flag is set, the created images will be shown (i.g. the map and elevation plot '
                             'will be opened after its creation). For this feature a desktop environment is needed. '
                             'Disabled as default (False).')

    generator = AutomatedWalkTableGenerator(parser.parse_args())
    generator.run()
