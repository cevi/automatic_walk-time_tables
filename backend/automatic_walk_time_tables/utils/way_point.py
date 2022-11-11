from automatic_walk_time_tables.utils.point import Point


class WayPoint:

    def __init__(self, accumulated_distance: float, point: Point, name: str = None) -> None:
        self.accumulated_distance = accumulated_distance
        self.point = point
        self.__name = name

    def __str__(self) -> str:
        return "WayPoint at " + str(self.accumulated_distance) + " with coordinates: " + str(self.point)

    def __repr__(self) -> str:
        return self.__str__()

    @property
    def name(self) -> str:
        if self.__name is None:
            return "({} / {})".format(round(self.point.lat), round(self.point.lon))

        return self.__name

    @name.setter
    def name(self, name: str) -> None:
        self.__name = name

    def to_json(self):
        return {
            "accumulated_distance": self.accumulated_distance,
            "point": self.point.to_json(),
            "name": self.name
        }