from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils.path import Path


class EquidistantTransformer(PathTransformer):
    """
    Fetches the names for each point in the path.
    """

    def __init__(self, equidistant_distance=10):
        super().__init__()
        self.equidistant_distance = equidistant_distance

    def transform(self, path_: Path) -> Path:
        """
        Interpolates points across the path to guarantee equidistant distribution.
        """

        equidistant_path = Path()
        equidistant_path.route_name = path_.route_name

        if len(path_.way_points) == 0:
            return equidistant_path

        equidistant_path.append(path_.way_points[0])

        accumulated_distance = path_.way_points[0].accumulated_distance
        target_distance = accumulated_distance + self.equidistant_distance

        for i in range(1, len(path_.way_points)):
            p_prev = path_.way_points[i - 1]
            p_curr = path_.way_points[i]

            # Interpolate points along the segment until we reach the current point's accumulated distance
            while target_distance <= p_curr.accumulated_distance:
                # Calculate interpolation factor
                segment_dist = p_curr.accumulated_distance - p_prev.accumulated_distance
                if segment_dist == 0:
                    break
                
                t = (target_distance - p_prev.accumulated_distance) / segment_dist
                
                prev_lv95 = p_prev.point.to_LV95()
                curr_lv95 = p_curr.point.to_LV95()
                
                inter_y = prev_lv95.lat + t * (curr_lv95.lat - prev_lv95.lat)
                inter_x = prev_lv95.lon + t * (curr_lv95.lon - prev_lv95.lon)
                inter_h = prev_lv95.h + t * (curr_lv95.h - prev_lv95.h)
                
                from automatic_walk_time_tables.utils.point import Point_LV95
                from automatic_walk_time_tables.utils.way_point import WayPoint
                
                inter_pt = Point_LV95(inter_y, inter_x, inter_h)
                new_wp = WayPoint(target_distance, inter_pt)
                equidistant_path.append(new_wp)
                
                target_distance += self.equidistant_distance

        # Always append the exact final point if it wasn't strictly hit and distance warrants
        if equidistant_path.way_points[-1].accumulated_distance < path_.way_points[-1].accumulated_distance:
            equidistant_path.append(path_.way_points[-1])

        return equidistant_path
