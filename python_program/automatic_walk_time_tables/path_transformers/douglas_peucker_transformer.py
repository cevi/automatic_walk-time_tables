from __future__ import annotations

import copy
import logging
import math
from typing import List

import numpy as np

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils.geometry_utils import calc_secant_line, calc_secant_elevation
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.way_point import WayPoint


class DouglasPeuckerTransformer(PathTransformer):
    """

    Algorithm that selects suitable points for the Marschzeittabelle.
    Some parts are inspired by the Ramer–Douglas–Peucker algorithm.

    The final selection includes as many POIs as possible. However, the inclusion of a POI is not guaranteed.

    path_ : path imported from GPX / KML
    walk_point_limit : max number of points in the walk-time table, default 21
    -------------------------------------------------------------------------
    The aim is to choose points that are as evenly distributed as possible
    and that cover the topology of the path as well as possible.

    """

    max_derivation_limit = 50
    """ 
    maximum_error between the original path and the modified waypoint path [in meters]
    """

    closeness_threshold = 0.03
    maximum_poi_error = 50

    def __init__(self, pois: Path = None, number_of_waypoints=21):
        super().__init__()

        self.number_of_waypoints = number_of_waypoints
        self.__logger = logging.getLogger(__name__)

        if pois is None:
            pois = Path(points=[])

        self.pois = pois

    def transform(self, path: Path):

        way_points = self.douglas_peucker(path.copy())
        self.__logger.debug("%d way point selected for final walk time table", way_points.number_of_waypoints)
        self.__logger.debug("Total distance: %f km", path.total_distance)

        way_points = self.replace_with_close_by_pois(way_points, path)

        return way_points

    def replace_with_close_by_pois(self, way_points: Path, original_waypoints: Path) -> Path:
        """

        Replace points close to a POI with the POI if secant elevation allows it.
        We are ignoring the start and end point of the path.

        """

        pois = self.pois.copy()

        final_way_points = Path()

        for i, p in enumerate(way_points.way_points):

            if i == 0 or i == len(way_points.way_points) - 1:
                final_way_points.append(p)
                continue

            # find closest poi
            closest_poi = min(pois.way_points, key=lambda poi: abs(poi.accumulated_distance - p.accumulated_distance))

            # Check if the poi lies between way_points[i - 1] and way_points[i + 1]
            if not (way_points.way_points[i - 1].accumulated_distance < closest_poi.accumulated_distance <
                    way_points.way_points[i + 1].accumulated_distance):
                final_way_points.insert(p)
                continue

            can_replace = True

            # Check points before the poi
            m, b = calc_secant_line(way_points.way_points[i - 1], closest_poi)
            points_between_poi = self.points_between(way_points.way_points[i - 1], closest_poi,
                                                     original_waypoints.way_points)
            for original_point in points_between_poi:
                secant_elev = calc_secant_elevation(m, b, original_point)
                can_replace &= abs(secant_elev - original_point.point.h) < self.maximum_poi_error

            # Check points after the poi
            m, b = calc_secant_line(closest_poi, way_points.way_points[i + 1])
            points_between_poi = self.points_between(closest_poi, way_points.way_points[i + 1],
                                                     original_waypoints.way_points)
            for original_point in points_between_poi:
                secant_elev = calc_secant_elevation(m, b, original_point)
                can_replace &= abs(secant_elev - original_point.point.h) < self.maximum_poi_error

            if can_replace:
                self.__logger.debug("Replace point #%d (%s) with POI (%s)", i, way_points.way_points[i].point.__str__(),
                                    closest_poi.point.__str__())
                final_way_points.append(closest_poi)
                pois.remove(closest_poi)
                continue

            # TODO: add addtional POIs
            # if we haven't included all POIs in the path, we could add additional, new waypoints based on the
            # leftovers of the POIs. We add them in the order of the furthers secant to path distance.

            final_way_points.insert(p)

        return final_way_points

    def douglas_peucker(self, way_points: Path):
        """

        Final selection: Iteratively reduce the number of points to the maximum specified in walk_point_limit. To
        achieve this we iteratively increase a maximum derivation (drv_limit) value until we have dropped enough points.

        """

        drv_limit = 0

        pt_dropped = True
        dropped_pts_archive = Path()

        keep_pois = True

        while way_points.number_of_waypoints > self.number_of_waypoints or self.closeness_criteria(way_points):

            # increase drv_limit if no points as been dropped in the last pass
            if not pt_dropped:
                log_length = math.log(way_points.number_of_waypoints)
                drv_limit += max(1, int(log_length))

            # Once the drv_limit of 50m is reached, we allow for a poi to be dropped
            if drv_limit >= self.max_derivation_limit and keep_pois:
                self.__logger.debug("Allow for a drop of a POI")
                keep_pois = False
                drv_limit = 0

            pt_dropped = self.drop_points(drv_limit, dropped_pts_archive, way_points, keep_pois)

            # if no points have been dropped,
            # we don't allow for a poi to be dropped until drv_limit is reached 50m again
            if pt_dropped:
                keep_pois = True

        return way_points

    def drop_points(self, drv_limit, pts_dropped: Path, way_points: Path, keep_pois: bool):
        """

        Remove WayPoint by the secant criteria.

        Three adjacent points (A, B, and B) are used to construct a secant line
        (a straight line between A and C). Point B is now tested against the drv_limit. If C has a derivation
        bigger than the limit, C gets dropped or moved to a new location, i.g. if the distance between point C and a
        point on secant line at the same location is bigger than drv_limit, C gets dropped or moved.

        Point B gets moved if and only if after the removal of point B a previously dropped point D is now further way
        from the secant line than the drv_limit. In this case be gets dropped and D gets added again, thus be gets
        replaced with point D in ths case. In all other cases B gets dropped.

        Once we've checked that. Points A, B, and C are shifted. If B gets dropped, A remains the same.
        This process is repeated until we have reached the walk_point_limit. If no point gets dropped during a pass
        through the selected points, we increase drv_limit by 2 meters and try again.

        """

        self.__logger.debug("drv_limit is set to %s", drv_limit)

        pt_a: WayPoint | None = None
        pt_b: WayPoint | None = None

        pt_dropped = False

        for pt_c in way_points.way_points:

            # after moving point B we skip one iteration
            if pt_b == pt_c:
                continue

            if pt_b in self.pois.way_points and keep_pois:
                continue

            if pt_a is not None and pt_b is not None:

                m, b = calc_secant_line(pt_a, pt_c)
                secant_elev = calc_secant_elevation(m, b, pt_b)

                if abs(secant_elev - pt_b.point.h) < drv_limit:

                    # Check if B must be replaced by a previously dropped point D
                    pt_d = None
                    for pt in self.points_between(pt_a, pt_c, pts_dropped.way_points):
                        secant_elev = calc_secant_elevation(m, b, pt)
                        if abs(secant_elev - pt.point.h) >= drv_limit:
                            pt_d = pt
                            break

                    if pt_d is not None:  # Replace B with point D
                        way_points.remove(pt_b)
                        index = next(x for x, val in enumerate(way_points.way_points) if
                                     val.accumulated_distance > pt_d.accumulated_distance)
                        way_points.insert(pt_d, index)
                        pts_dropped.insert(pt_b)

                    else:  # remove point B
                        pt_dropped = True

                        way_points.remove(pt_b)
                        pts_dropped.insert(pt_b)

                        pt_b = pt_a

            pt_a = pt_b
            pt_b = pt_c
        return pt_dropped

    def points_between(self, pt_start: WayPoint, pt_end: WayPoint, original_waypoints: List[WayPoint]) -> \
            List[WayPoint]:
        """

        Returns all way points between to way points.

        """
        return list(filter(
            lambda p: pt_start.accumulated_distance < p.accumulated_distance < pt_end.accumulated_distance,
            original_waypoints))

    def closeness_criteria(self, path_: Path) -> bool:
        """

        Check if two selected way points are too close to each other
        with respect to the route length and elevation profile.

        """

        distance_threshold = self.closeness_threshold * path_.way_points[-1].accumulated_distance
        self.__logger.debug('Total distance {}, distance_threshold {}'
                            .format(path_.way_points[-1].accumulated_distance, distance_threshold))

        heights = [p.point.h for p in path_.way_points]
        elevation_delta = (np.max(heights) - np.min(heights))
        elevation_threshold = self.closeness_threshold * elevation_delta
        self.__logger.debug(
            'Total elevation_delta {}, elevation_threshold {}'.format(elevation_delta, elevation_threshold))

        for p1, p2 in zip(path_.way_points[:-1], path_.way_points[1:]):

            delta_dist = p2.accumulated_distance - p1.accumulated_distance
            delta_height = abs(p2.point.h - p1.point.h)

            if p1 == p2:
                continue

            if delta_dist < distance_threshold and delta_height < elevation_threshold:
                self.__logger.debug(
                    'delta_height {} vs elevation_threshold {}'.format(delta_height, elevation_threshold))
                self.__logger.debug('delta_dist {} vs distance_threshold {}'.format(delta_dist, distance_threshold))
                self.__logger.debug(
                    "Points found, which are to close to each other: {} and {}".format(p1.point.__str__(),
                                                                                       p2.point.__str__()))
                return True

        return False
