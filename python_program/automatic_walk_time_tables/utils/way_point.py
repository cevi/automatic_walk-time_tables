from automatic_walk_time_tables.utils.point import Point


class WayPoint:

    def __init__(self, accumulated_distance: float, point: Point) -> None:
        self.accumulated_distance = accumulated_distance
        self.point = point
