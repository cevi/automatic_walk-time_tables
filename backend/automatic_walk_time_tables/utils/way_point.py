from automatic_walk_time_tables.utils.point import Point, point_from_json


class WayPoint:
    def __init__(
        self, accumulated_distance: float, point: Point, name: str = None
    ) -> None:
        self.accumulated_distance = accumulated_distance
        self.point = point
        self.__name = name

    def __str__(self) -> str:
        return (
            "WayPoint at "
            + str(self.accumulated_distance)
            + " with coordinates: "
            + str(self.point)
        )

    def __repr__(self) -> str:
        return self.__str__()

    @property
    def name(self) -> str:
        return self.__name if self.__name else ""

    @name.setter
    def name(self, name: str) -> None:
        self.__name = name

    def to_json(self):
        return {
            "accumulated_distance": self.accumulated_distance,
            "point": self.point.to_json(),
            "name": self.name,
        }


def way_point_from_json(json):
    return WayPoint(
        json["accumulated_distance"], point_from_json(json["point"]), json["name"]
    )
