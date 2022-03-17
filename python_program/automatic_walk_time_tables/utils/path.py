from . import point

class Path:
    def __init__(self):
        pass

class Path_LV03(Path):
    """ LV03 coordinates """
    def __init__(self, points):
        self.points = points
    
    def to_WGS84(self):
        """ convert LV03 to WGS84 """
        wgs84_points = []
        for point in self.points:
            wgs84_points.append(point.to_WGS84())
        return Path_WGS84(wgs84_points)

class Path_WGS84(Path):
    """ WGS84 coordinates """
    def __init__(self, points):
        self.points = points
    
    def to_LV03(self):
        """ convert WGS84 to LV03 """
        lv03_points = []
        for point in self.points:
            lv03_points.append(point.to_LV03())
        return Path_LV03(lv03_points)