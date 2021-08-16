from datetime import datetime

import gpxpy.gpx

from find_walk_table_points import select_waypoints
from python_program.create_map import plot_route_on_map
from python_program.walk_table import plot_elevation_profile, create_walk_table


def generate_automated_walk_table(departure_date, gpx_file_path, velocity):
    # Open GPX-File with the way-points
    gpx_file = open(gpx_file_path, 'r')
    raw_gpx_data = gpxpy.parse(gpx_file)

    # get Meta-Data
    name = raw_gpx_data.tracks[0].name

    # calc Points for walk table
    total_distance, temp_points, way_points = select_waypoints(raw_gpx_data)
    plot_elevation_profile(raw_gpx_data, way_points, temp_points, file_name=name)
    create_walk_table(departure_date, velocity, way_points, total_distance, file_name=name)
    plot_route_on_map(raw_gpx_data, way_points, file_name=name)


if __name__ == "__main__":
    # defines the departure time of the hike
    DEPARTURE_TIME = datetime(year=2021, month=8, day=16, hour=10, minute=00)

    # Path to the GPX-File with the pre-planed route
    GPX_FILE_PATH = './testWalks/wanderweg_823.gpx'

    # Velocity , walk-speed in km/h
    VELOCITY = 3.75

    generate_automated_walk_table(DEPARTURE_TIME, GPX_FILE_PATH, VELOCITY)
