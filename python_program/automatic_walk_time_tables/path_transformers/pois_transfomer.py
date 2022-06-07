import numpy as np

from automatic_walk_time_tables.path_transformers.path_transfomer import PathTransformer
from automatic_walk_time_tables.utils.path import Path


class POIsTransformer(PathTransformer):
    """
        Transformer which transforms a path to a path containing only pois.
    """

    def __init__(self) -> None:
        super().__init__()

    def transform(self, path: Path) -> Path:
        pois = Path([path.way_points[0].point])

        # calc extremums of path_
        max_index = np.argmax([p.point.h for p in path.way_points])
        min_index = np.argmin([p.point.h for p in path.way_points])

        pois.insert(path.way_points[max_index])
        pois.insert(path.way_points[min_index])

        # TODO: calc points of interest
        # Either the user passes the POIs with the API call or we have to calculate them.
        # In the latter case, these are to be calculated using the map data, e.g. exciting points like mountain peaks,
        # significant river crossings, castles/runes, significant forest edges, etc.
        # Ths should be done with a call to the swiss_TLM API.

        # add endpoint to list of points of interest
        pois.append(path.way_points[-1])

        return pois
