from typing import Callable, List, Sequence, Tuple

import numpy as np


def kmeans(
    points: Sequence[Sequence[float]],
    initial_centers: Sequence[Sequence[float]],
    metric: Callable[[Sequence[float], Sequence[float]], float],
    tolerance: float = 0.001,
    max_iterations: int = 200,
) -> Tuple[List[List[int]], List[List[float]]]:
    """
    K-means clustering with a custom distance metric (Lloyd's algorithm, as pyclustering's kmeans).

    Every point is assigned to the nearest center by the metric, every center moves to the mean of its points;
    empty clusters are dropped. Stops when no center moves more than the tolerance (measured by the metric).
    Returns the clusters (indices into points) and their centers as plain lists (they end up in JSON).
    """
    data = np.asarray(points, dtype=float)
    centers = [np.asarray(c, dtype=float) for c in initial_centers]
    clusters: List[List[int]] = []

    for _ in range(max_iterations):
        assignments: List[List[int]] = [[] for _ in centers]
        for index, point in enumerate(data):
            nearest = min(range(len(centers)), key=lambda c: metric(point, centers[c]))
            assignments[nearest].append(index)
        clusters = [members for members in assignments if members]
        updated = [data[members].mean(axis=0) for members in clusters]

        if len(updated) != len(centers):
            change = float("inf")
        else:
            change = max(metric(old, new) for old, new in zip(centers, updated))
        centers = updated
        if change <= tolerance:
            break

    return clusters, [center.tolist() for center in centers]
