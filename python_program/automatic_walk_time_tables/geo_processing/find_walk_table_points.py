from __future__ import annotations

import logging
import math
from typing import List, Tuple

import numpy as np

from automatic_walk_time_tables.utils import path
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)


def replace_with_close_by_pois(way_points: List[WayPoint],
                               pois: List[WayPoint],
                               original_waypoints: List[WayPoint]) -> List[WayPoint]:
    """

    Replace points close to a POI with the POI if secant elevation allows it.
    We are ignoring the start and end point of the path.

    """

    pois = pois.copy()

    final_way_points = []

    for i, p in enumerate(way_points):

        if i == 0 or i == len(way_points) - 1:
            final_way_points.append(p)
            continue

        # find closest poi
        closest_poi = min(pois, key=lambda poi: abs(poi.accumulated_distance - p.accumulated_distance))

        # Check if the poi lies between way_points[i - 1] and way_points[i + 1]
        if not (way_points[i - 1].accumulated_distance < closest_poi.accumulated_distance <
                way_points[i + 1].accumulated_distance):
            final_way_points.append(p)
            continue

        can_replace = True

        # TODO: make this parameter configurable
        # maximum_error between the original path and the modified waypoint path [in meters]
        maximum_error = 50

        # Check points before the poi
        m, b = calc_secant_line(way_points[i - 1], closest_poi)
        points_between_poi = points_between(way_points[i - 1], closest_poi, original_waypoints)
        for original_point in points_between_poi:
            secant_elev = calc_secant_elevation(m, b, original_point)
            can_replace &= abs(secant_elev - original_point.point.h) < maximum_error

        # Check points after the poi
        m, b = calc_secant_line(closest_poi, way_points[i + 1])
        points_between_poi = points_between(closest_poi, way_points[i + 1], original_waypoints)
        for original_point in points_between_poi:
            secant_elev = calc_secant_elevation(m, b, original_point)
            can_replace &= abs(secant_elev - original_point.point.h) < maximum_error

        if can_replace:
            logger.debug("Replace point #%d (%s) with POI (%s)", i, way_points[i].point.__str__(),
                         closest_poi.point.__str__())
            final_way_points.append(closest_poi)
            pois.remove(closest_poi)
            continue

        final_way_points.append(p)

    return final_way_points


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

    original_waypoints = path_.to_waypoints()
    total_distance = original_waypoints[-1].accumulated_distance

    pois = calc_points_of_interest(original_waypoints)

    way_points = ramer_douglas_peucker(original_waypoints, pois, walk_point_limit)
    logger.debug("%d way point selected for final walk time table", len(way_points))
    logger.debug("Total distance: %f km", total_distance)

    way_points = replace_with_close_by_pois(way_points, pois, original_waypoints)

    return total_distance, pois, way_points


def ramer_douglas_peucker(way_points: List[WayPoint], pois: List[WayPoint], walk_point_limit: int):
    """

    Final selection: Iteratively reduce the number of points to the maximum specified in walk_point_limit. To
    achieve this we iteratively increase a maximum derivation (drv_limit) value until we have dropped enough points.

    """

    drv_limit = 0

    pt_dropped = True
    dropped_pts_archive: List[WayPoint] = []

    keep_pois = True

    while len(way_points) > walk_point_limit or closeness_criteria(way_points):

        # increase drv_limit if no points as been dropped in the last pass
        if not pt_dropped:
            log_length = math.log(len(way_points))
            drv_limit += max(1, int(log_length))

        # TODO: make this parameter configurable
        # Once the drv_limit of 50m is reached, we allow for a poi to be dropped
        if drv_limit >= 50 and keep_pois:
            logger.debug("Allow for a drop of a POI")
            keep_pois = False
            drv_limit = 0

        pt_dropped = drop_points(drv_limit, dropped_pts_archive, way_points, pois, keep_pois)

        # if no points have been dropped, we don't allow for a poi to be dropped until drv_limit is reached 50m again
        if pt_dropped:
            keep_pois = True

    return way_points


def drop_points(drv_limit, pts_dropped: List[WayPoint], way_points: List[WayPoint], pois: List[WayPoint],
                keep_pois: bool):
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

    logger.debug("drv_limit is set to %s", drv_limit)

    pt_a: WayPoint | None = None
    pt_b: WayPoint | None = None

    pt_dropped = False

    for pt_c in way_points:

        # after moving point B we skip one iteration
        if pt_b == pt_c:
            continue

        if pt_b in pois and keep_pois:
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


def points_between(pt_start: WayPoint, pt_end: WayPoint, original_waypoints: List[WayPoint]) -> List[WayPoint]:
    """

    Returns all way points between to way points.

    """
    return list(filter(
        lambda p: pt_start.accumulated_distance < p.accumulated_distance < pt_end.accumulated_distance,
        original_waypoints))


def closeness_criteria(path_: List[WayPoint]) -> bool:
    """

    Check if two selected way points are too close to each other
    with respect to the route length and elevation profile.

    """

    # TODO: make this parameter configurable
    threshold = 0.03

    distance_threshold = threshold * path_[-1].accumulated_distance
    logger.debug('Total distance {}, distance_threshold {}'.format(path_[-1].accumulated_distance, distance_threshold))

    heights = [p.point.h for p in path_]
    elevation_delta = (np.max(heights) - np.min(heights))
    elevation_threshold = threshold * elevation_delta
    logger.debug('Total elevation_delta {}, elevation_threshold {}'.format(elevation_delta, elevation_threshold))

    for p1, p2 in zip(path_[:-1], path_[1:]):

        delta_dist = p2.accumulated_distance - p1.accumulated_distance
        delta_height = abs(p2.point.h - p1.point.h)

        if p1 == p2:
            continue

        if delta_dist < distance_threshold and delta_height < elevation_threshold:
            logger.debug('delta_height {} vs elevation_threshold {}'.format(delta_height, elevation_threshold))
            logger.debug('delta_dist {} vs distance_threshold {}'.format(delta_dist, distance_threshold))
            logger.debug("Points found, which are to close to each other: {} and {}".format(p1.point.__str__(),
                                                                                            p2.point.__str__()))
            return True

    return False


def calc_points_of_interest(path_: List[WayPoint]) -> List[WayPoint]:
    """
        Calculates points of interest along the path.
    """

    pois: List[WayPoint] = path_[:1]

    # calc extremums of path_
    max_index = np.argmax([p.point.h for p in path_])
    min_index = np.argmin([p.point.h for p in path_])

    pois.append(path_[max_index])
    pois.append(path_[min_index])

    # TODO: calc points of interest
    # random point
    pois.append(path_[560])
    pois.append(path_[870])

    # add endpoint to list of points of interest
    pois.append(path_[-1])

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
