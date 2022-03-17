from geo_processing import coord_transformation

# Abstract Base class
class Point:
    def __init__(self):
        pass

class Point_LV03(Point):
    """ LV03 coordinates """
    def __init__(self, x, y, h = None):
        self.x = x
        self.y = y
        self.h = h # elevation

    def to_WGS84(self):
        """ convert LV95 to WGS84 """
        converter = coord_transformation.GPSConverter()
        wgs84 = converter.LV03toWGS84(self.x, self.y, self.h)
        return Point_WGS84(wgs84[0], wgs84[1], wgs84[2])

class Point_WGS84(Point):
    """ WGS84 coordinates """
    def __init__(self, lat, lon, h = None):
        self.lat = lat
        self.lon = lon
        self.h = h # elevation

    def to_LV03(self):
        """ convert WGS84 to LV03 """
        converter = coord_transformation.GPSConverter()
        lv03 = converter.WGS84toLV03(self.lat, self.lon, self.h)
        return Point_LV03(lv03[0], lv03[1], lv03[2])