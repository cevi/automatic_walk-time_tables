from typing import Tuple

from automatic_walk_time_tables.utils import path, point
from automatic_walk_time_tables.utils.way_point import WayPoint


def calc_secant_elevation(m: float, b: float, pt: WayPoint):
    """
    Calculates the elevation of a point on the secant line defined by m and b. The point on the
    secant line is chosen such that location matches the location of pkr_B.
    elevation = m * loc_of_pt_B + b
    """

    return m * pt.accumulated_distance + b


def calc_secant_line(pt_A: WayPoint, pt_B: WayPoint):
    """
    Constructs a secant line through points A and B, i.g. a linear function passing through point A and B.
    Returns the slope and intersection of a linear function through A and B.
    """

    # the locations of pt_A and pt_B given is given in m.
    x1, y1 = pt_A.accumulated_distance, pt_A.point.h
    x2, y2 = pt_B.accumulated_distance, pt_B.point.h

    # if the location of A and B is identical, the slope m is defined as 0
    m: float = (y1 - y2) / (x1 - x2) if (x1 - x2) != 0 else 0.0

    # if the location of A and B is identical, the intercept is given by y1 (since y1 == y2)
    b: float = (x1 * y2 - x2 * y1) / (x1 - x2) if (x1 - x2) != 0 else y1

    return m, b


def calc_perimeter(path_: path.Path) -> Tuple[point.Point_LV03, point.Point_LV03]:
    min_latitude = None
    max_latitude = None
    min_longitude = None
    max_longitude = None

    for pt in path_.way_points:
        p = pt.point.to_LV03()
        if min_latitude is None or p.lat < min_latitude:
            min_latitude = p.lat

        if max_latitude is None or p.lat > max_latitude:
            max_latitude = p.lat

        if min_longitude is None or p.lon < min_longitude:
            min_longitude = p.lon

        if max_longitude is None or p.lon > max_longitude:
            max_longitude = p.lon

    return point.Point_LV03(min_latitude, min_longitude), point.Point_LV03(
        max_latitude, max_longitude
    )
