import logging
from copy import copy
from typing import List, Tuple

import geopy.distance
from automatic_walk_time_tables.utils import path, point

logger = logging.getLogger(__name__)


def select_waypoints(path : path.Path, walk_point_limit=21):
    """
    Algorithm that selects suitable points for the Marschzeittabelle.
    Some parts are inspired by the Ramer–Douglas–Peucker algorithm. Especially
    the third step, which reduces the number of points.
    path : path imported from GPX / KML
    walk_point_limit : max number of points in the walk-time table, default 21
    -------------------------------------------------------------------------
    The aim is to choose points that are as evenly distributed as possible
    and that cover the topology of the path as well as possible. The process
    is done in three steps: preselection, remove_unnecessary_points, reduce_number_of_points.
    """

    total_distance, pts_step_1 = preselection_step(path)

    logger.debug("Preselection returned %d points", len(pts_step_1))

    pts_step_2 = remove_unnecessary_points(pts_step_1)

    logger.debug("Remove unnecessary points returned %d points", len(pts_step_2))

    pts_step_3 = reduce_number_of_points(pts_step_2, walk_point_limit)

    logger.debug("Reduce number of points returned %d points", len(pts_step_3))
    logger.debug("Total distance: %f km", total_distance)

    return total_distance, pts_step_2, pts_step_3


def reduce_number_of_points(pts_step_2: List[Tuple[float, point.Point]], walk_point_limit: int):
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

    pts_step_3: List[Tuple[float, point.Point]] = copy(pts_step_2)

    pt_A: Tuple[float, point.Point] = None
    pt_B: Tuple[float, point.Point] = None

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

                if abs(secant_elev - pt_B[1].h) < drv_limit:

                    # Check if B must be replaced by a previously dropped point D
                    pt_D = None
                    for pt in list(filter(lambda p: pt_A[0] < p[0] < pt_C[0], pts_dropped)):
                        secant_elev = calc_secant_elevation(m, b, pt)
                        if abs(secant_elev - pt[1].h) >= drv_limit:
                            pt_D = pt
                            break

                    if pt_D is not None:  # Replace B with point D
                        pts_step_3.remove(pt_B)
                        index = next(x for x, val in enumerate(pts_step_3) if val[0] > pt_D[0])
                        pts_step_3.insert(pts_step_3[index][0], pt_D)
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


def remove_unnecessary_points(pts_step_1: List[Tuple[int, point.Point]]):
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

    last_pt: Tuple[float, point.Point] = pts_step_1[0]
    pts_step_2: List[Tuple[float, point.Point]] = [last_pt]

    for pt in pts_step_1[1:]:

        if last_pt is not None:

            last_coord = get_coordinates(last_pt[1].to_WGS84())
            coord = get_coordinates(pt[1].to_WGS84())

            if (abs(last_pt[1].h - pt[1].h) > 20
                and geopy.distance.distance(last_coord, coord).m > 250) \
                    or geopy.distance.distance(last_coord, coord).m > 1500: # TODO: this line seems obsole, bug?

                m, b = calc_secant_line(last_pt, pt)

                # add point with max derivation
                for intermediate_point in list(filter(lambda p: last_pt[0] < p[0] < pt[0], pts_step_1)):

                    derivation = abs(calc_secant_elevation(m, b, intermediate_point) - intermediate_point[1].h)
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


def preselection_step(path : path.Path):
    """
        Preselection: Select all points from the tracking file which satisfy one of the following criteria.
        This guarantees that all important points are considered. We call the set of selected points pts_step_1.
        Preselection criteria:
        - first or last point of a track segment
        - significant local extremum in track elevation
        - significant changes in elevation based on the approximated slope
        - distance to last selected point bigger than 250 meters
    """

    cumulated_distance = 0.0
    pts_step_1: List[Tuple[float, point.Point]] = []

    lastSlope = None
    lastCoord = None

    lastPoint = None

    # (1) Preselection
    for i,pt in enumerate(path.points):
        newCoord = get_coordinates(pt.to_WGS84())

        if i == 0: # First point
            pts_step_1.append((0, pt))
            lastCoord = get_coordinates(pt.to_WGS84())
            lastSlope = 0.
        elif i == len(path.points) - 1: # Last point
            distDelta = geopy.distance.distance(lastCoord, newCoord).km
            cumulated_distance += distDelta
            pts_step_1.append((cumulated_distance, pt))
        else: # Any other point
            distDelta = geopy.distance.distance(lastCoord, newCoord).km
            cumulated_distance += distDelta

            if distDelta > 0.:
                newSlope = (pt.h - pts_step_1[-1][1].h) / distDelta
                if abs(newSlope) > 0.0:
                    if abs(newSlope - lastSlope) > 0.5: # Slope change
                        pts_step_1.append((cumulated_distance, pt))
                        lastSlope = newSlope
                        lastCoord = newCoord
                        continue
                        
                if geopy.distance.distance(lastCoord, newCoord).m > 250:
                    pts_step_1.append((cumulated_distance, pt))
                    lastCoord = newCoord
                    lastSlope = newSlope
                    continue

    return cumulated_distance, pts_step_1


def calc_secant_elevation(m: float, b: float, pt_B: Tuple[float, point.Point]):
    """
    Calculates the elevation of a point on the secant line defined by m and b. The point on the
    secant line is chosen such that location matches the location of pkr_B.
    elevation = m * loc_of_pt_B + b
    """

    # pt_B[0] returns the location of point B in km
    return m * (pt_B[0] * 1000) + b


def calc_secant_line(pt_A: Tuple[float, point.Point], pt_C: Tuple[float, point.Point]):
    """
    Constructs a secant line through points A and C, i.g. a linear function passing through point A and C.
    Returns the slope and the intersect of a linear function through A and C.
    """

    # the locations of pt_A and pt_C given in km.
    x1, y1 = pt_A[0] * 1000, pt_A[1].h
    x2, y2 = pt_C[0] * 1000, pt_C[1].h

    # if the location of A and C is identical, the slope m is defined as 0
    m: float = (y1 - y2) / (x1 - x2) if (x1 - x2) != 0 else 0.0

    # if the location of A and C is identical, the intercept is given by y1 (since y1 == y2)
    b: float = (x1 * y2 - x2 * y1) / (x1 - x2) if (x1 - x2) != 0 else y1

    return m, b


def prepare_for_plot(path : path.Path):
    """
    Prepares a gpx file for plotting.
    Returns two list, one with the elevation of all points in the gpx file and one with the associated,
    accumulated distance form the starting point.
    """

    coord: Tuple[float, float] = None
    accumulated_distance: float = 0.0

    distances: List[float] = []
    heights: List[float] = []

    for pt in path.points:

        newCoord = get_coordinates(pt.to_WGS84())

        if coord is not None:
            distDelta = geopy.distance.distance(coord, newCoord).km
            accumulated_distance += distDelta

        distances.append(accumulated_distance)
        heights.append(pt.h)

        coord = newCoord

    return distances, heights
