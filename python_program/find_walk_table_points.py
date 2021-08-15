from copy import deepcopy

import geopy.distance
import gpxpy


def select_waypoints(raw_gpx_data: gpxpy.gpx, walk_point_limit=21):
    """

    Algorithm that selects suitable points for the Marschzeittabelle.

    raw_gpx_data : raw gpx data from imported GPX-File
    walk_point_limit : max number of points in the walk-time table, default 21

    -------------------------------------------------------------------------

    The aim is to choose points that are as evenly distributed as possible
    and that cover the topology of the path as well as possible. The process
    is done in three steps:

    (1) TODO: REPLACE CURRENT ALGORITHM!
        Preselection: Select all points form the tracking file according which satisfies one of the following criteria.
        This guarantees that all important points are considered.

        Preselection criteria:
        - first or last point of a track segment
        - significant local extremum in track elevation
        - significant changes in elevation based on the approximated slope
        - distance to last selected point bigger than 500 meters
        - elevation difference to last selected point bigger than 50 meters

    (2) TODO: UNDERSTAND CURRENT ALGORITHM AND IMPROVE ON IT (E.G. ENSURE MINIMAL DISTANCE BETWEEN TWO POINTS)

    (3) Final selection: Iteratively reduce the number of points to the maximum specified in walk_point_limit. To
        achieve this we iteratively increase a maximum derivation (drv_limit) value until we have dropped enough points.

        For this purpose, three preselected, adjacent points (A, B, and B) are used to construct a secant line
        (a straight line between A and C). Point B is now tested against the drv_limit. If C has a derivation
        bigger than the limit, C gets dropped or moved to a new location, i.g. if the distance between point C and a
        point on secant line at the same location is bigger than drv_limit, C gets dropped or moved (Note: We do not
        calculate the Least-Square distance).

        Point B gets moved if and only if after the removal of point B a previously dropped point D is now further way
        from the secant line than the drv_limit. In this case be gets dropped and D gets added again, thus be gets
        replaced with point D in ths case. In all other cases B gets dropped.

        Once we've checked that. Points A, B, and C are shifted. If B gets dropped, A remains the same.
        This process is repeated until we have reached the walk_point_limit. If no point gets dropped during a pass
        through the selected points, we increase drv_limit by 2 meters and try again.

    """

    total_distance = 0
    way_points_walk_table = []

    oldHeight = 0
    slope = None
    coord = None

    for track in raw_gpx_data.tracks:
        for segment in track.segments:

            # insert first point
            way_points_walk_table.append((0, segment.points[0]))

            for point in segment.points:

                newCoord = (point.latitude, point.longitude)

                if coord is not None:

                    distDelta = geopy.distance.distance(coord, newCoord).km
                    total_distance += distDelta

                    if distDelta != 0:
                        newSlope = (oldHeight - point.elevation) / distDelta

                        if slope is not None and newSlope != 0 and (
                                (slope / newSlope < -0.75 or abs(slope / newSlope) > 1.5)):
                            way_points_walk_table.append((total_distance, point))

                        slope = newSlope

                coord = newCoord
                oldHeight = point.elevation

            # insert last point
            if abs(way_points_walk_table[len(way_points_walk_table) - 1][0] - total_distance) < 0.5:
                del way_points_walk_table[len(way_points_walk_table) - 1]
            way_points_walk_table.append((total_distance, segment.points[len(segment.points) - 1]))

    # remove points
    final_way_points_walk_table = [way_points_walk_table[0]]
    old_index = 0

    for i, point in enumerate(way_points_walk_table):

        pkt_A = final_way_points_walk_table[len(final_way_points_walk_table) - 1]

        if pkt_A == point:
            continue

        b, m = calc_secant_line(pkt_A, point)

        diff = 0
        max_diff = 0
        for j in range(old_index, i):
            diff += abs(calc_secant_elevation(b, m, way_points_walk_table[j]) - way_points_walk_table[j][1].elevation)

            if max_diff < diff:
                max_diff = diff

        diff /= float(i - old_index)

        if diff > 15 or max_diff > 100 or point[0] - pkt_A[0] > 1.5:

            new_index = int(old_index + 2.0 / 3.0 * (i - old_index))
            new_point = way_points_walk_table[new_index]

            if new_point[0] - pkt_A[0] > 0.25:
                final_way_points_walk_table.append(new_point)

            else:
                new_index = int(old_index + 1.0 / 2.0 * (i - old_index))
                new_point = way_points_walk_table[new_index]
                final_way_points_walk_table.remove(pkt_A)
                final_way_points_walk_table.append(new_point)

            old_index = new_index

    final_way_points_walk_table.append(way_points_walk_table[len(way_points_walk_table) - 1])

    temp_points = deepcopy(final_way_points_walk_table)

    # (3) Step three, drop points on a secant line.
    pkt_A = None
    pkt_B = None
    pkt_dropped = True
    drv_limit = 0
    dropped_points = []

    while len(final_way_points_walk_table) > walk_point_limit:

        # Increase drv_limit if no points as been dropped in the last pass
        if not pkt_dropped:
            drv_limit += 1
        pkt_dropped = False

        for pkt_C in final_way_points_walk_table:

            if pkt_A is not None and pkt_B is not None:

                b, m = calc_secant_line(pkt_A, pkt_C)
                secant_elev = calc_secant_elevation(b, m, pkt_B)

                if abs(secant_elev - pkt_B[1].elevation) < drv_limit:

                    # Check if B must be replaced by a previously dropped point D
                    pkt_D = None
                    for pkt in list(filter(lambda p: pkt_A[0] < p[0] < pkt_C[0], dropped_points)):
                        secant_elev = calc_secant_elevation(b, m, pkt)
                        if abs(secant_elev - pkt[1].elevation) >= drv_limit:
                            pkt_D = pkt
                            break

                    if pkt_D is not None:  # Replace B with point D
                        index = final_way_points_walk_table.index(pkt_B)
                        final_way_points_walk_table.insert(index, pkt_D)
                        final_way_points_walk_table.remove(pkt_B)
                        dropped_points.append(pkt_B)
                        pkt_B = pkt_D

                    else:  # remove point B
                        pkt_dropped = True

                        final_way_points_walk_table.remove(pkt_B)
                        dropped_points.append(pkt_B)

                        pkt_B = pkt_A

            pkt_A = pkt_B
            pkt_B = pkt_C

        pkt_A = None
        pkt_B = None

    return total_distance, temp_points, final_way_points_walk_table


def calc_secant_elevation(b, m, pkt_B):
    return m * (pkt_B[0] * 1000) + b


def calc_secant_line(pkt_A, pkt_C):
    x1, y1 = pkt_A[0] * 1000, pkt_A[1].elevation
    x2, y2 = pkt_C[0] * 1000, pkt_C[1].elevation

    m = (y1 - y2) / (x1 - x2)
    b = (x1 * y2 - x2 * y1) / (x1 - x2)

    return b, m


def prepare_for_plot(gpx):
    coord = None
    total_distance = 0
    distances = []
    heights = []

    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                newCoord = (point.latitude, point.longitude)

                if coord is not None:
                    distDelta = geopy.distance.distance(coord, newCoord).km
                    total_distance += distDelta

                distances.append(total_distance)
                heights.append(point.elevation)

                coord = newCoord

    return distances, heights
