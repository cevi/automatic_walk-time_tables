import copy
import re
from typing import List

import polyline

from .point import Point_LV03, Point
from .way_point import WayPoint


class Path:
    """

    Represents a path on a map. A path is an ordered list of way points,
    where each way point can have a name, an accumulated distance from the beginning of the path,
    and an associated point object, which can be converted in all used coordinate systems (LV95, LV03, and WGS84).

    Path objects can be manipulated with PathTransformers, e.g. a naming transformer can be applied,
    which adds names to all way points.

    """

    def __init__(self, points: List[Point] = None) -> None:

        self.__way_points: List[WayPoint] = []
        self.__total_distance = 0.0

        self.route_name = ""

        self.append_points(points)

    def append_points(self, points: List[Point]) -> None:
        """

        Appends a list of points to the current path.
        Points will be appended to the end of the path.

        """

        if points is None or len(points) == 0:
            return

        for i, pkt in enumerate(points):

            if i == 0 and len(self.__way_points) == 0:
                self.__way_points.append(WayPoint(0.0, pkt.to_LV03()))
                continue

            last_coord: Point_LV03 = self.__way_points[-1].point.to_LV03()
            coord: Point_LV03 = pkt.to_LV03()

            self.__total_distance += last_coord.distance(coord)
            self.__way_points.append(WayPoint(self.__total_distance, coord))

    def append(self, way_point: WayPoint) -> None:
        """
        Appends a way point to the end of the path.
        """

        if self.__total_distance == way_point.accumulated_distance != 0.0:
            return

        assert self.__total_distance <= way_point.accumulated_distance

        self.__total_distance = way_point.accumulated_distance
        self.__way_points.append(way_point)

    def insert(self, way_point: WayPoint, index: int = None) -> None:
        """

        Inserts a way point to the path.
        If the index is not passed as an argument,the way point will be inserted automatically at the correct position.
        Otherwise, the way point will be inserted at the given index.

        """

        if (index is None and way_point.accumulated_distance >= self.__total_distance) \
                or (index is not None and index >= self.number_of_waypoints):
            self.append(way_point)
            return

        # Insert in correct place
        if index is None:
            index = next(i for i, pkt in enumerate(self.__way_points) if
                         pkt.accumulated_distance >= way_point.accumulated_distance)

        self.__way_points.insert(index, way_point)

    def remove(self, way_point: WayPoint):
        self.__way_points.remove(way_point)
        self.__total_distance = self.__way_points[-1].accumulated_distance

    def clear(self) -> None:
        """

        Clears the current path, i.g. deletes all way points.

        """

        del self.__way_points
        self.__way_points = []
        self.route_name = ""
        self.__total_distance = 0.0

    def has_elevation_for_all_points(self) -> bool:
        for pt in self.__way_points:
            if not pt.point.has_elevation():
                return False

        return True

    @property
    def total_distance(self):
        return self.__total_distance

    @property
    def way_points(self):
        return self.__way_points

    @property
    def number_of_waypoints(self):
        return len(self.__way_points)

    def copy(self):
        copy_ = copy.deepcopy(self)
        return copy_

    def get_filename(self):

        """
        Returns a filename safe variant of the route name.
        The route name may contain special characters (/, ", '. ?, (, ), etc.),
        whereas the filename does replace those with a dash.
        """

        return re.sub(r'[\W_]+', '-', self.route_name).strip().lower()

    def __str__(self) -> str:
        return "Path: " + self.route_name + ", points: " + str(self.__way_points)

    def __repr__(self) -> str:
        return self.__str__()

    def to_json(self):

        return {
            "route_name": self.route_name,
            "way_points": [wp.to_json() for wp in self.__way_points]
        }

    def to_polyline(self):
        return polyline.encode(
            list(map(lambda pkt: (pkt.point.to_LV95().lat, pkt.point.to_LV95().lon), self.__way_points)), 0)

    def to_elevation_polyline(self):
        return polyline.encode(
            list(map(lambda pkt: (pkt.accumulated_distance, pkt.point.h), self.__way_points)), 0)

    def get_names(self):
        return [wp.name for wp in self.__way_points]