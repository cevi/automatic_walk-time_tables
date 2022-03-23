import requests
import logging
import json

from . import point, path

logger = logging.getLogger(__name__)

class HeightFetcher:
    def __init__(self):
        self.SINGLE_POINT_URL = "https://api3.geo.admin.ch/rest/services/height"
        self.PATH_URL = "https://api3.geo.admin.ch/rest/services/profile.json"

    def fetch_single_point(self, point : point.Point_LV03) -> point.Point_LV03:
        """
        Fetch the elevation for a single point.
        """

        params = {
            "easting": point.lat,
            "northing": point.lon,
            "sr": 21781 # LV03
        }

        r = requests.get(self.SINGLE_POINT_URL, params=params)

        logger.debug("Fetched elevation for point and got " + str(r.status_code))

        if r.status_code != 200:
            logger.info(r.status_code)
            logger.info(r.text)
            raise Exception("Failed to fetch elevation for point")
        
        # return the point with elevation
        logger.debug("Got height" + r.json()["height"])
        return point.Point_LV03(point.lat, point.lon, float(r.json()["height"]))

    def fetch_path(self, path_ : path.Path_LV03) -> path.Path_LV03:
        """
        Fetch the elevation for a path.
        """

        # check that the path does not have more than 5000 points
        if len(path_.points) > 5000:
            raise Exception("Path has more than 5000 points, above rate limit.")
        
        geom_data = {
                "type": "LineString",
                "coordinates": [
                    [pt.lat, pt.lon] for pt in path_.points
                ]
            }

        params = {
            "geom": json.dumps(geom_data),
            "nb_points": len(path_.points),
            "distinct_points": True,
            "sr": 21781 # LV03
        }

        r = requests.get(self.PATH_URL, params=params)
        logger.debug("Fetched elevation for path and got " + str(r.status_code))

        if r.status_code != 200:
            logger.info(r.status_code)
            logger.info(r.text)
            raise Exception("Failed to fetch elevation for path")

        # return the path with elevation
        return_path = path.Path_LV03()
        for entry in r.json():
            return_path.points.append(point.Point_LV03(entry["easting"], entry["northing"], float(entry["alts"]["COMB"])))

        return return_path

