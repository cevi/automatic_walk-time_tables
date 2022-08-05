import math

from automatic_walk_time_tables.geo_processing import coord_transformation


class PointType:
    NONE = "NONE"
    LV03 = "LV03"
    LV95 = "LV95"
    WGS84 = "WGS84"


# Abstract Base class
class Point:
    def __init__(self, lat: float, lon: float, h: float = -1.0) -> None:
        self.lat = lat
        self.lon = lon
        self.h = h
        self.type = PointType.NONE

    def to_LV03(self):
        raise Exception("Not possible on base class.")

    def to_LV95(self):
        raise Exception("Not possible on base class.")

    def to_WGS84(self):
        raise Exception("Not possible on base class.")

    def has_elevation(self) -> bool:
        return self.h > 0.0  # assume switzerland, where there is no point below 0

    def __str__(self):
        return "Point: lat: " + str(self.lat) + ", lon: " + str(self.lon) + ", h: " + str(self.h)

    def __repr__(self):
        return self.__str__()

    def to_json(self):

        lv95 = self.to_LV95()

        return {
            "lat": lv95.lat,
            "lon": lv95.lon,
            "h": lv95.h,
            "type": lv95.type
        }


class Point_LV95(Point):

    def __init__(self, lat: float, lon: float, h: float = -1.0) -> None:
        super().__init__(lat, lon, h)
        self.type = PointType.LV95

    def to_LV95(self):
        """ convert LV95 to LV95 """
        return self

    def to_WGS84(self):
        """ convert LV95 to WGS84 """
        return self.to_LV03().to_WGS84()

    def to_LV03(self):
        """ convert LV95 to LV03 """
        return Point_LV03(self.lat - 2_000_000, self.lon - 1_000_000, self.h)


class Point_LV03(Point):
    """ LV03 coordinates """

    def __init__(self, lat: float, lon: float, h: float = -1.0) -> None:
        super().__init__(lat, lon, h)
        self.type = PointType.LV03

    def to_WGS84(self):
        """ convert LV03 to WGS84 """
        converter = coord_transformation.GPSConverter()
        wgs84 = converter.LV03toWGS84(self.lat, self.lon, self.h)
        return Point_WGS84(wgs84[0], wgs84[1], wgs84[2] if self.h != -1. else -1.0)

    def to_LV03(self):
        """ convert LV03 to LV03 """
        return self

    def to_LV95(self) -> Point_LV95:
        """ convert LV03 to LV95 """

        return Point_LV95(self.lat + 2_000_000, self.lon + 1_000_000, self.h)

    def distance(self, pkt):
        """ Calculates the distance between two Point_LV03 in meters """
        return math.sqrt(math.pow(self.lat - pkt.lat, 2) + math.pow(self.lon - pkt.lon, 2))


class Point_WGS84(Point):
    """ WGS84 coordinates """

    def __init__(self, lat: float, lon: float, h: float = -1.0):
        super().__init__(lat, lon, h)
        self.type = PointType.WGS84

    def to_LV03(self):
        """ convert WGS84 to LV03 """
        converter = coord_transformation.GPSConverter()
        lv03 = converter.WGS84toLV03(self.lat, self.lon, self.h)
        return Point_LV03(lv03[0], lv03[1], self.h)

    def to_WGS84(self):
        """ convert WGS84 to WGS84 """
        return self
