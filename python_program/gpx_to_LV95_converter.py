# A small python script that converts a GPX file
# with wgs84 points to a json file containing LV95 points

import argparse
import json
import os

from automatic_walk_time_tables.utils.file_parser import parse_gpx_file

parser = argparse.ArgumentParser(description='GPX to JSON converter')
parser.add_argument('--filename', type=str, help='GPX file name', required=True)

args = parser.parse_args()
print(args.filename)

with open(args.filename, 'r') as route_file:
    lv03_path = parse_gpx_file(route_file)

points = [(2_000_000 + pkt.lat, 1_000_000 + pkt.lon) for pkt in lv03_path.points]

filename = os.path.splitext(args.filename)[0]

with open(filename + '.json', 'w') as f:
    json.dump(points, f)
