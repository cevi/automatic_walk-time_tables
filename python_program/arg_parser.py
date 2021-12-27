import argparse
from datetime import datetime


def str2bool(v):
    if isinstance(v, bool):
        return v
    if v.lower() in ('yes', 'true', 't', 'y', '1', 'j', 'ja'):
        return True
    elif v.lower() in ('no', 'false', 'f', 'n', '0', 'nein'):
        return False
    else:
        return False


def create_parser():
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
    parser.add_argument('--output_directory', default='', type=str,
                            help='Subdirectory in the output folder for storing the created files. Should be empty or ending with "/"')
    parser.add_argument('--log-level', type=int, metavar='<log-level>', default=30,
                        help='Log Level (see https://docs.python.org/3/library/logging.html#levels). Default: WARNING.')

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

    return parser
