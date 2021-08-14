import geopy.distance
import gpxpy


def select_waypoints(raw_gpx_data: gpxpy.gpx):
    """

    Algorithm that selects suitable points for the Marschzeittabelle.

    The aim is to choose points that are as evenly distributed as possible
    and that cover the topology of the path as well as possible.

    """

    total_distance = 0
    way_points_walk_table = []

    oldHeight = 0
    slope = None
    coord = None

    points = []

    for track in raw_gpx_data.tracks:
        for segment in track.segments:

            # insert first point
            way_points_walk_table.append((0, segment.points[0]))

            for point in segment.points:

                newCoord = (point.latitude, point.longitude)

                if coord is not None:

                    distDelta = geopy.distance.distance(coord, newCoord).km
                    total_distance += distDelta
                    points.append(point)

                    if distDelta != 0:
                        newSlope = (oldHeight - point.elevation) / distDelta

                        if slope is not None and newSlope != 0 and (
                                (slope / newSlope < -0.75 or abs(slope / newSlope) > 2)):
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

        old_point = final_way_points_walk_table[len(final_way_points_walk_table) - 1]

        if old_point == point:
            continue

        x1, y1 = old_point[0], old_point[1].elevation
        x2, y2 = point[0], point[1].elevation

        m = (y1 - y2) / (x1 - x2)
        b = (x1 * y2 - x2 * y1) / (x1 - x2)

        diff = 0
        max_diff = 0
        for j in range(old_index, i):
            diff += abs(m * way_points_walk_table[j][0] + b - way_points_walk_table[j][1].elevation)

            if max_diff < diff:
                max_diff = diff

        diff /= float(i - old_index)

        if diff > 15 or max_diff > 100 or point[0] - old_point[0] > 1.5:

            new_index = int(old_index + 2.0 / 3.0 * (i - old_index))
            new_point = way_points_walk_table[new_index]

            if new_point[0] - old_point[0] > 0.25:
                final_way_points_walk_table.append(new_point)

            else:
                new_index = int(old_index + 1.0 / 2.0 * (i - old_index))
                new_point = way_points_walk_table[new_index]
                final_way_points_walk_table.remove(old_point)
                final_way_points_walk_table.append(new_point)

            old_index = new_index

    final_way_points_walk_table.append(way_points_walk_table[len(way_points_walk_table) - 1])

    # check for points on one line
    old_point = None
    current_point = None
    removedAPoint = True

    deviation = 0

    while removedAPoint or len(final_way_points_walk_table) > 30:

        if not removedAPoint:
            deviation += 5

        removedAPoint = False

        for next_point in final_way_points_walk_table:

            if old_point is not None:

                x1, y1 = old_point[0], old_point[1].elevation
                x2, y2 = next_point[0], next_point[1].elevation

                m = (y1 - y2) / (x1 - x2)
                b = (x1 * y2 - x2 * y1) / (x1 - x2)

                if abs(m * current_point[0] + b - current_point[1].elevation) < deviation:
                    final_way_points_walk_table.remove(current_point)
                    removedAPoint = True

            old_point = current_point
            current_point = next_point

    print('Anzahl Punkte: ' + str(len(final_way_points_walk_table)))

    print(raw_gpx_data.length_3d())
    print(raw_gpx_data.length_2d())
    print(total_distance)

    return total_distance, way_points_walk_table, final_way_points_walk_table


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
