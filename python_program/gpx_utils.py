import numpy as np

from python_program.transformation import GPSConverter


def calc_perimeter(raw_gpx_data):
    min_latitude = None
    max_latitude = None
    min_longitude = None
    max_longitude = None

    for track in raw_gpx_data.tracks:
        for segment in track.segments:
            for point in segment.points:

                if min_latitude is None or point.latitude < min_latitude:
                    min_latitude = point.latitude

                if max_latitude is None or point.latitude > max_latitude:
                    max_latitude = point.latitude

                if min_longitude is None or point.longitude < min_longitude:
                    min_longitude = point.longitude

                if max_longitude is None or point.longitude > max_longitude:
                    max_longitude = point.longitude

        # convert Coordinates to LV03
        converter = GPSConverter()
        lv03_min = np.round(converter.WGS84toLV03(min_latitude, min_longitude, 400))
        lv03_max = np.round(converter.WGS84toLV03(max_latitude, max_longitude, 400))

    return lv03_min, lv03_max
