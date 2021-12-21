# Set up logging
from automatic_walk_time_tables.log_helper import Formatter
import logging

# Change this line to enable debug log messages:
logging.root.setLevel(logging.INFO)

logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
handler.setFormatter(Formatter())
logger.addHandler(handler)

import argparse

from datetime import datetime

import gpxpy.gpx

from automatic_walk_time_tables.find_walk_table_points import select_waypoints
from automatic_walk_time_tables.map_downloader.create_map import plot_route_on_map
from automatic_walk_time_tables.map_numbers import find_map_numbers
from automatic_walk_time_tables.walk_table import plot_elevation_profile, create_walk_table

def generate_automated_walk_table(args: argparse.Namespace):
   
    # Open GPX-File with the way-points
    gpx_file = open(args.gpx_file_name, 'r')

    logger.debug("Reading %s", args.gpx_file_name)

    # print all args and their options to logger.info
    logger.debug("Arguments:")
    for arg in vars(args):
        logger.debug("  %s: %s", arg, getattr(args, arg))

    raw_gpx_data = gpxpy.parse(gpx_file)

    # get Meta-Data
    name = raw_gpx_data.name
    map_numbers = find_map_numbers(raw_gpx_data) # map numbers and their names as a single string

    logger.debug("GPX Name: %s", name)
    logger.debug("Map Numbers: %s", map_numbers)

    if args.create_excel or args.create_map_pdfs or args.create_elevation_profile:

        # calc Points for walk table
        total_distance, temp_points, way_points = select_waypoints(raw_gpx_data)

        if args.create_elevation_profile:
            logger.debug('Boolean indicates that we should create the elevation profile.')
            plot_elevation_profile(raw_gpx_data, way_points, temp_points, file_name=name, open_figure=args.open_figure)

        if args.create_excel:
            logger.debug('Boolean indicates that we shoudl create walk-time table as Excel file')
            name_of_points = create_walk_table(args.departure_time, args.velocity, way_points, total_distance,
                                               file_name=name, creator_name=args.creator_name, map_numbers=map_numbers)
        else:
            name_of_points = [''] * len(way_points)

        if args.create_map_pdfs:
            logger.debug('Boolean indicates that we should create map PDFs.')
            plot_route_on_map(raw_gpx_data, way_points, file_name=name, map_scaling=args.map_scaling,
                              name_of_points=name_of_points)


def str2bool(v):
    if isinstance(v, bool):
        return v
    if v.lower() in ('yes', 'true', 't', 'y', '1', 'j', 'ja'):
        return True
    elif v.lower() in ('no', 'false', 'f', 'n', '0', 'nein'):
        return False
    else:
        logger.error('Boolean value expected.')
        raise argparse.ArgumentTypeError('Boolean value expected.')


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
    
    generate_automated_walk_table(parser.parse_args())
