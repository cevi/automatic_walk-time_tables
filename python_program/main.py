from datetime import datetime

import gpxpy.gpx

from find_walk_table_points import select_waypoints
from python_program.create_map import plot_route_on_map
from python_program.walk_table import plot_elevation_profile, create_walk_table

# Open GPX-File with the way-points
gpx_file = open('./testWalks/murgseentourtag2.gpx', 'r')
raw_gpx_data = gpxpy.parse(gpx_file)

# define the departure time of the hike
start_time = datetime(year=2021, month=8, day=16, hour=10, minute=00)

# get Meta-Data
name = raw_gpx_data.tracks[0].name

# calc Points for walk table
total_distance, temp_points, way_points = select_waypoints(raw_gpx_data)

# Walk-Speed in km/h
walk_speed = 3.75

plot_elevation_profile(raw_gpx_data, way_points, temp_points, file_name=name + '.png')
create_walk_table(start_time, walk_speed, way_points, total_distance)
# plot_route_on_map(raw_gpx_data, way_points)
