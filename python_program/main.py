import argparse
from datetime import datetime

import gpxpy.gpx

from automatic_walk_time_tables.find_walk_table_points import select_waypoints
from automatic_walk_time_tables.map_numbers import find_map_numbers
from automatic_walk_time_tables.walk_table import plot_elevation_profile, create_walk_table
from automatic_walk_time_tables.map_downloader.create_map import plot_route_on_map


def generate_automated_walk_table(departure_date, gpx_file_path, velocity, open_figure: bool, map_scaling: int,
                                  creator_name: str):
    # Open GPX-File with the way-points
    gpx_file = open(gpx_file_path, 'r')
    raw_gpx_data = gpxpy.parse(gpx_file)

    # get Meta-Data
    name = raw_gpx_data.name

    map_numbers = find_map_numbers(raw_gpx_data)

    # calc Points for walk table
    total_distance, temp_points, way_points = select_waypoints(raw_gpx_data)
    plot_elevation_profile(raw_gpx_data, way_points, temp_points, file_name=name, open_figure=open_figure)
    create_walk_table(departure_date, velocity, way_points, total_distance, file_name=name, creator_name=creator_name,
                      map_numbers=map_numbers)
    plot_route_on_map(raw_gpx_data, way_points, file_name=name, open_figure=open_figure, map_scaling=map_scaling)


if __name__ == "__main__":
    # Initialize parser
    msg = "Supported command-line args: "
    parser = argparse.ArgumentParser(description=msg)

    # Adding arguments
    parser.add_argument('--gpx-file-name', type=str,
                        help='Name and path to the GPX file, if not specified ./GPX/Default_Route.gpx will be used as '
                             'default value.', default='./GPX/Default_Route.gpx')
    parser.add_argument('--velocity', type=float, default=3.75,
                        help='Float. Speed in km/h on which the calculation is based, default 3.75 km/h.')
    parser.add_argument('--map-scaling', type=int,
                        help='Integer. Scaling of the created map (e.g. 10000 for scaling of 1:10\'000), if not '
                             'specified the scaling will be automatically chosen.')
    parser.add_argument('--open-figure', default=False, action='store_true',
                        help='If this flag is set, the created images will be shown (i.g. the map and elevation plot '
                             'will be opened after its creation). For this feature a desktop environment is needed.')
    parser.add_argument('--departure-time', type=lambda s: datetime.fromisoformat(s),
                        default=datetime(year=2021, month=8, day=16, hour=9, minute=00),
                        help='Departure date in ISO-format, i.g. 2011-11-04T00:05:23. Default 2021-08-16T09:00:00.')
    parser.add_argument('--creator-name', type=str,
                        help='Name of you, the creator of this route. If not specified, it will be empty.', default='')

    args = parser.parse_args()

    generate_automated_walk_table(departure_date=args.departure_time,
                                  gpx_file_path=args.gpx_file_name,
                                  velocity=args.velocity,
                                  open_figure=args.open_figure,
                                  map_scaling=args.map_scaling,
                                  creator_name=args.creator_name)
