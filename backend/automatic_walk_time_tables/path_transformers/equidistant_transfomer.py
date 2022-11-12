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
        Selects a equidistant subset of the path.
        """

        equidistant_path = Path()
        equidistant_path.append(path_.way_points[0])

        accumulated_distance = 0

        # select a point every 10 meters
        for p in path_.way_points:
            if p.accumulated_distance - accumulated_distance > self.equidistant_distance:
                equidistant_path.append(p)
                accumulated_distance = p.accumulated_distance

        equidistant_path.append(path_.way_points[-1])

        return equidistant_path
