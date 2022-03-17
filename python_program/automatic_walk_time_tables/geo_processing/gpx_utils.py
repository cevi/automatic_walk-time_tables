
# TODO: merge together with GPX parser?

from automatic_walk_time_tables.utils import path, point
from typing import Tuple

def calc_perimeter(path : path.Path) -> Tuple[point.Point_LV03, point.Point_LV03] :
    min_latitude = None
    max_latitude = None
    min_longitude = None
    max_longitude = None

    for pt in path.points:
        p = pt.to_LV03()
        if min_latitude is None or p.lat < min_latitude:
            min_latitude = p.lat

        if max_latitude is None or p.lat > max_latitude:
            max_latitude = p.lat

        if min_longitude is None or p.lon < min_longitude:
            min_longitude = p.lon

        if max_longitude is None or p.lon > max_longitude:
            max_longitude = p.lon

    return point.Point_LV03(min_latitude, min_longitude), point.Point_LV03(max_latitude, max_longitude)
