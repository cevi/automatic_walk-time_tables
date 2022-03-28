from . import point
from typing import List
import copy

class PathType:
    NONE = "NONE"
    LV03 = "LV03"
    WGS84 = "WGS84"

class Path:
    def __init__(self, points : List[point.Point] = []):
        self.route_name = ""
        self.points = copy.deepcopy(points)
        self.type = PathType.NONE

    def clear(self):
        del self.points

        self.points = []
        self.route_name = ""

    def check_points(self):
        """ checks all points if they have the same type as the path """
        for p in self.points:
            if p.type != self.type:
                raise Exception('At least one point has wrong type')

    def to_LV03(self):
        raise Exception("Not possible on base class.")
    def to_WGS84(self):
        raise Exception("Not possible on base class.")

    def has_elevation_for_all_points(self):
        for pt in self.points:
            if not pt.has_elevation():
                return False

        return True

    def __str__(self):
        return "Path: " + self.route_name + ", points: " + str(self.points)

    def __repr__(self):
        return self.__str__()

class Path_LV03(Path):
    """ LV03 coordinates """
    def __init__(self, points : List[point.Point_LV03] = []):
        super().__init__(points)
        self.type = PathType.LV03
        self.check_points()
    
    def to_WGS84(self):
        """ convert LV03 to WGS84 """
        wgs84_points = []
        for point in self.points:
            wgs84_points.append(point.to_WGS84())
        ret = Path_WGS84(wgs84_points)
        ret.route_name = self.route_name
        return ret

class Path_WGS84(Path):
    """ WGS84 coordinates """
    def __init__(self, points : List[point.Point_WGS84] = []):
        super().__init__(points)
        self.type = PathType.WGS84

        self.check_points()

    def to_LV03(self):
        """ convert WGS84 to LV03 """
        lv03_points = []
        for point in self.points:
            lv03_points.append(point.to_LV03())
        ret = Path_LV03(lv03_points)
        ret.route_name = self.route_name
        return ret