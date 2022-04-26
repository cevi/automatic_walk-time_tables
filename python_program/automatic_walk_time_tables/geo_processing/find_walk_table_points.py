from __future__ import annotations

import logging
import math
from typing import List, Tuple

import numpy as np

from automatic_walk_time_tables.utils import path
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)


def select_waypoints(path_: path.Path_LV03, walk_point_limit=21) -> Tuple[float, List[WayPoint], List[WayPoint]]:
    """

    Algorithm that selects suitable points for the Marschzeittabelle.
    Some parts are inspired by the Ramer–Douglas–Peucker algorithm.

    The final selection includes as many POIs as possible. However, the inclusion of a POI is not guaranteed.

    path_ : path imported from GPX / KML
    walk_point_limit : max number of points in the walk-time table, default 21
    -------------------------------------------------------------------------
    The aim is to choose points that are as evenly distributed as possible
    and that cover the topology of the path as well as possible.

    """

    way_points = path_.to_waypoints()
    total_distance = way_points[-1].accumulated_distance

    pois = calc_points_of_interest(path_)
    logger.debug("%d points of interest found", len(pois))

    way_points = ramer_douglas_peucker(way_points, walk_point_limit)
    logger.debug("%d way point selected for final walk time table", len(way_points))
    logger.debug("Total distance: %f km", total_distance)

    # TODO: approximate waypoints with POIs

    return total_distance, pois, way_points


def ramer_douglas_peucker(way_points: List[WayPoint], walk_point_limit: int):
    """

    Final selection: Iteratively reduce the number of points to the maximum specified in walk_point_limit. To
    achieve this we iteratively increase a maximum derivation (drv_limit) value until we have dropped enough points.

    """

    drv_limit = 0

    pt_dropped = True
    dropped_pts_archive: List[WayPoint] = []

    count = 0

    while len(way_points) > walk_point_limit or closeness_criteria(way_points):

        count += 1

        # increase drv_limit if no points as been dropped in the last pass
        if not pt_dropped:
            log_length = math.log(len(way_points))
            drv_limit += max(1, int(log_length))

        pt_dropped = drop_points(drv_limit, dropped_pts_archive, way_points)

    return way_points


def drop_points(drv_limit, pts_dropped, way_points):
    """

    Remove WayPoint by the secant criteria.

    Three adjacent points (A, B, and B) are used to construct a secant line
    (a straight line between A and C). Point B is now tested against the drv_limit. If C has a derivation
    bigger than the limit, C gets dropped or moved to a new location, i.g. if the distance between point C and a
    point on secant line at the same location is bigger than drv_limit, C gets dropped or moved.

    Point B gets moved if and only if after the removal of point B a previously dropped point D is now further way
    from the secant line than the drv_limit. In this case be gets dropped and D gets added again, thus be gets
    replaced with point D in ths case. In all other cases B gets dropped.

    Once we've checked that. Points A, B, and C are shifted. If B gets dropped, A remains the same.
    This process is repeated until we have reached the walk_point_limit. If no point gets dropped during a pass
    through the selected points, we increase drv_limit by 2 meters and try again.

    """

    pt_a: WayPoint | None = None
    pt_b: WayPoint | None = None

    pt_dropped = False

    for pt_c in way_points:

        # after moving point B we skip one iteration
        if pt_b == pt_c:
            continue

        if pt_a is not None and pt_b is not None:

            m, b = calc_secant_line(pt_a, pt_c)
            secant_elev = calc_secant_elevation(m, b, pt_b)

            if abs(secant_elev - pt_b.point.h) < drv_limit:

                # Check if B must be replaced by a previously dropped point D
                pt_d = None
                for pt in points_between(pt_a, pt_c, pts_dropped):
                    secant_elev = calc_secant_elevation(m, b, pt)
                    if abs(secant_elev - pt.point.h) >= drv_limit:
                        pt_d = pt
                        break

                if pt_d is not None:  # Replace B with point D
                    way_points.remove(pt_b)
                    index = next(x for x, val in enumerate(way_points) if
                                 val.accumulated_distance > pt_d.accumulated_distance)
                    way_points.insert(index, pt_d)
                    pts_dropped.append(pt_b)

                else:  # remove point B
                    pt_dropped = True

                    way_points.remove(pt_b)
                    pts_dropped.append(pt_b)

                    pt_b = pt_a

        pt_a = pt_b
        pt_b = pt_c
    return pt_dropped


def points_between(pt_start: WayPoint, pt_end: WayPoint, pts_dropped: List[WayPoint]) -> List[WayPoint]:
    """

    Returns all way points between to way points.

    """
    return list(filter(
        lambda p: pt_start.accumulated_distance < p.accumulated_distance < pt_end.accumulated_distance,
        pts_dropped))


def closeness_criteria(path_: List[WayPoint]) -> bool:
    """

    Check if two selected way points are too close to each other
    with respect to the route length and elevation profile.

    """

    threshold = 0.04

    distance_threshold = threshold * path_[-1].accumulated_distance
    logger.debug('Total distance {}, distance_threshold {}'.format(path_[-1].accumulated_distance, distance_threshold))

    heights = [p.point.h for p in path_]
    elevation_delta = (np.max(heights) - np.min(heights))
    elevation_threshold = threshold * elevation_delta
    logger.debug('Total elevation_delta {}, elevation_threshold {}'.format(elevation_delta, elevation_threshold))

    for p1, p2 in zip(path_, path_[1:]):

        delta_dist = p2.accumulated_distance - p1.accumulated_distance
        delta_height = abs(p2.point.h - p1.point.h)

        logger.debug('delta_height {} vs elevation_threshold {}'.format(delta_height, elevation_threshold))
        logger.debug('delta_dist {} vs distance_threshold {}'.format(delta_dist, distance_threshold))

        if delta_dist < distance_threshold and delta_height < elevation_threshold:
            logger.debug("Points found, which are to close to each other.")
            return True

    return False


def calc_points_of_interest(path_: path.Path) -> List[WayPoint]:
    """
        Calculates points of interest along the path.
    """

    pois: List[WayPoint] = [WayPoint(0, path_.points[0])]
    return pois


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
