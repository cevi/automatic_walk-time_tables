import logging
from copy import copy
from typing import List, Tuple

from automatic_walk_time_tables.utils import path, point
from automatic_walk_time_tables.utils.point import Point_LV03
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)


def select_waypoints(path_: path.Path_LV03, walk_point_limit=21) -> Tuple[float, List[WayPoint], List[WayPoint]]:
    """
    Algorithm that selects suitable points for the Marschzeittabelle.
    Some parts are inspired by the Ramer–Douglas–Peucker algorithm. Especially
    the third step, which reduces the number of points.
    path_ : path imported from GPX / KML
    walk_point_limit : max number of points in the walk-time table, default 21
    -------------------------------------------------------------------------
    The aim is to choose points that are as evenly distributed as possible
    and that cover the topology of the path as well as possible. The process
    is done in three steps: preselection, remove_unnecessary_points, reduce_number_of_points.
    """

    total_distance, pts_step_1 = preselection_step(path_)

    logger.debug("Preselection returned %d points", len(pts_step_1))

    pts_step_2 = remove_unnecessary_points(pts_step_1)

    logger.debug("Remove unnecessary points returned %d points", len(pts_step_2))

    pts_step_3 = reduce_number_of_points(pts_step_2, walk_point_limit)

    logger.debug("Reduce number of points returned %d points", len(pts_step_3))
    logger.debug("Total distance: %f km", total_distance)

    return total_distance, pts_step_2, pts_step_3


def reduce_number_of_points(pts_step_2: List[WayPoint], walk_point_limit: int):
    """
    Final selection: Iteratively reduce the number of points to the maximum specified in walk_point_limit. To
    achieve this we iteratively increase a maximum derivation (drv_limit) value until we have dropped enough points.
    For this purpose, three preselected, adjacent points (A, B, and B) are used to construct a secant line
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

    pts_step_3: List[WayPoint] = copy(pts_step_2)

    pt_A: WayPoint = None
    pt_B: WayPoint = None

    drv_limit = 0

    pt_dropped = True
    pts_dropped = []

    while len(pts_step_3) > walk_point_limit:

        # Increase drv_limit if no points as been dropped in the last pass
        if not pt_dropped:
            drv_limit += 1
        pt_dropped = False

        for pt_C in pts_step_3:

            # after moving point B we skip one iteration
            if pt_B == pt_C:
                continue

            if pt_A is not None and pt_B is not None:

                m, b = calc_secant_line(pt_A, pt_C)
                secant_elev = calc_secant_elevation(m, b, pt_B)

                if abs(secant_elev - pt_B.point.h) < drv_limit:

                    # Check if B must be replaced by a previously dropped point D
                    pt_D = None
                    for pt in list(
                            filter(lambda p: pt_A.accumulated_distance < p[0] < pt_C.accumulated_distance,
                                   pts_dropped)):
                        secant_elev = calc_secant_elevation(m, b, pt)
                        if abs(secant_elev - pt.point.h) >= drv_limit:
                            pt_D = pt
                            break

                    if pt_D is not None:  # Replace B with point D
                        pts_step_3.remove(pt_B)
                        index = next(x for x, val in enumerate(pts_step_3) if
                                     val.accumulated_distance > pt_D.accumulated_distance)
                        pts_step_3.insert(index, pt_D)
                        pts_dropped.append(pt_B)

                    else:  # remove point B
                        pt_dropped = True

                        pts_step_3.remove(pt_B)
                        pts_dropped.append(pt_B)

                        pt_B = pt_A

            pt_A = pt_B
            pt_B = pt_C

        pt_A = None
        pt_B = None
    return pts_step_3


def remove_unnecessary_points(pts_step_1: List[WayPoint]):
    """
    Now we loop through the preselected points and tighten the selection criteria.
    Into the list pts_step_2 we include points according to the following rules:
        - first or last point of a track segment
        - a points (called point C) with a delta elevation to the previous selected point (called point A, i.g. the last
          in point in pts_step_2) of at least 20 meters that are also at least 250 meters apart form the point A (i.g.
          the distance between A and C is at least 250 meters).
        - a point (called point C) that is at least 1'500 meters apart form the the last point (called C, i.g. the
          distance between A and C is at least 1'500 meters).
    After we selected a point C, we loop through all points B out of pts_step_1 that lie between point A and C.
    Now we construct a secant line (a straight line between A and C). A point B is now tested against the drv_limit.
    If B has a derivation bigger than the limit, B gets also included into the list pts_step_2, i.g. if the
    distance between point B and a point on secant line at the same location is bigger than drv_limit, C gets
    added.
    """

    drv_limit = 20

    last_pt: WayPoint = pts_step_1[0]
    pts_step_2: List[WayPoint] = [last_pt]

    for pt in pts_step_1[1:]:

        if last_pt is not None:

            last_coord = get_coordinates(last_pt.point)
            coord = get_coordinates(pt.point)

            if abs(last_pt.point.h - pt.point.h) > 20 and coord[0] - last_coord[0] > 250:

                m, b = calc_secant_line(last_pt, pt)

                # add point with max derivation
                for intermediate_point in \
                        list(filter(
                            lambda p: last_pt.accumulated_distance < p.accumulated_distance < pt.accumulated_distance,
                            pts_step_1)):

                    derivation = abs(calc_secant_elevation(m, b, intermediate_point) - intermediate_point.point.h)
                    if drv_limit <= derivation:
                        pts_step_2.append(intermediate_point)
                        drv_limit = derivation
                        m, b = calc_secant_line(intermediate_point, pt)
                        last_pt = pt

                pts_step_2.append(pt)
                last_pt = pt

    last_point = pts_step_1[len(pts_step_1) - 1]

    if last_pt != last_point:
        pts_step_2.append(last_point)

    return pts_step_2


def get_coordinates(pt: point.Point):
    return pt.lat, pt.lon


def preselection_step(path_: path.Path):
    """
        Preselection: Select all points from the tracking file which satisfy one of the following criteria.
        This guarantees that all important points are considered. We call the set of selected points pts_step_1.
        Preselection criteria:
        - first or last point of a track segment
        - significant local extremum in track elevation
        - significant changes in elevation based on the approximated slope
        - distance to last selected point bigger than 250 meters
    """

    accumulated_distance = 0.0
    way_points: List[WayPoint] = []

    last_slope = 0
    last_point = path_.points[0]

    # Insert first point of path
    way_points.append(WayPoint(0, last_point))

    # (1) Preselection
    for i in range(len(path_.points) - 2):

        last_coord: Point_LV03 = path_.points[i].to_LV03()
        coord: Point_LV03 = path_.points[i + 1].to_LV03()

        delta_dist = last_coord.distance(coord)
        accumulated_distance += delta_dist

        # skip duplicated points in GPX file, less than 1cm in distance
        if delta_dist <= 0.01:
            continue

        slope = (coord.h - way_points[-1].point.h) / delta_dist
        if abs(slope) > 0. and abs(slope - last_slope) > 0.5:  # significant slope change
            way_points.append(WayPoint(accumulated_distance, coord))

        elif accumulated_distance - way_points[-1].accumulated_distance > 250:
            way_points.append(WayPoint(accumulated_distance, coord))

        # TODO: add significant local extremum in track elevation

    # Insert last point of path
    way_points.append(WayPoint(accumulated_distance, path_.points[-1]))

    logger.info(""
                "Total route length = {}m".format(accumulated_distance))

    return accumulated_distance, way_points


def calc_secant_elevation(m: float, b: float, pt_B: WayPoint):
    """
    Calculates the elevation of a point on the secant line defined by m and b. The point on the
    secant line is chosen such that location matches the location of pkr_B.
    elevation = m * loc_of_pt_B + b
    """

    # pt_B[0] returns the location of point B in meter
    return m * pt_B.accumulated_distance + b


def calc_secant_line(pt_A: WayPoint, pt_C: WayPoint):
    """
    Constructs a secant line through points A and C, i.g. a linear function passing through point A and C.
    Returns the slope and the intersect of a linear function through A and C.
    """

    # the locations of pt_A and pt_C given is given in m.
    x1, y1 = pt_A.accumulated_distance, pt_A.point.h
    x2, y2 = pt_C.accumulated_distance, pt_C.point.h

    # if the location of A and C is identical, the slope m is defined as 0
    m: float = (y1 - y2) / (x1 - x2) if (x1 - x2) != 0 else 0.0

    # if the location of A and C is identical, the intercept is given by y1 (since y1 == y2)
    b: float = (x1 * y2 - x2 * y1) / (x1 - x2) if (x1 - x2) != 0 else y1

    return m, b


def prepare_for_plot(path_: path.Path_LV03):
    """
    Prepares a gpx file for plotting.
    Returns two list, one with the elevation of all points in the gpx file and one with the associated,
    accumulated distance form the starting point.
    """

    coord: Point_LV03 = None
    accumulated_distance: float = 0.0

    distances: List[float] = []
    heights: List[float] = []

    for pt in path_.points:

        if coord is not None:
            accumulated_distance += coord.distance(pt)

        distances.append(accumulated_distance)
        heights.append(pt.h)

        coord = pt

    return distances, heights
