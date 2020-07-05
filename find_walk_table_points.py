import geopy.distance


def find_points(gpx):
    total_distance = 0
    way_points_walk_table = []

    heights = []
    distances = []
    oldHeight = 0
    slope = None
    coord = None

    points = []

    for track in gpx.tracks:
        for segment in track.segments:

            # insert first point
            way_points_walk_table.append((0, segment.points[0]))

            for point in segment.points:

                newCoord = (point.latitude, point.longitude)

                if coord is not None:

                    distDelta = geopy.distance.distance(coord, newCoord).km
                    total_distance += distDelta
                    distances.append(total_distance)
                    heights.append(point.elevation)
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
    current_point = None
    final_way_points_walk_table = [way_points_walk_table[0]]
    max_heights_delta = max([h.elevation for h in segment.points]) - min([h.elevation for h in segment.points])

    for next_point in way_points_walk_table:

        if current_point is not None:

            old_point = final_way_points_walk_table[len(final_way_points_walk_table) - 1]

            x1, y1 = old_point[0], old_point[1].elevation
            x2, y2 = next_point[0], next_point[1].elevation

            m = (y1 - y2) / (x1 - x2)
            b = (x1 * y2 - x2 * y1) / (x1 - x2)

            diff = abs(m * current_point[0] + b - current_point[1].elevation)

            if diff > min(max_heights_delta * 0.05, 25):
                final_way_points_walk_table.append(current_point)

            if (current_point[0] - old_point[0]) > 1:
                final_way_points_walk_table.append(current_point)

        current_point = next_point
    final_way_points_walk_table.append(way_points_walk_table[len(way_points_walk_table) - 1])

    print('Anzahl Punkte: ' + str(len(final_way_points_walk_table)))

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
