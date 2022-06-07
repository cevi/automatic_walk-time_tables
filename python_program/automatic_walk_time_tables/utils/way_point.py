from automatic_walk_time_tables.utils.point import Point


class WayPoint:

    def __init__(self, accumulated_distance: float, point: Point) -> None:
        self.accumulated_distance = accumulated_distance
        self.point = point

    def __str__(self) -> str:
        return "WayPoint at " + str(self.accumulated_distance) + " with coordinates: " + str(self.point)

    def __repr__(self) -> str:
        return self.__str__()
