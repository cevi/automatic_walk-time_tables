import json
import unittest

from automatic_walk_time_tables.utils.kmeans import kmeans


def chebyshev(a, b):
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]))


class KMeansTest(unittest.TestCase):
    def test_two_groups(self):
        points = [[0, 0], [1, 0], [0, 1], [10, 10], [11, 10], [10, 11]]
        clusters, centers = kmeans(points, [[0, 0], [10, 10]], chebyshev)
        self.assertEqual(sorted(map(sorted, clusters)), [[0, 1, 2], [3, 4, 5]])
        self.assertEqual(sorted(centers), [[1 / 3, 1 / 3], [31 / 3, 31 / 3]])

    def test_empty_cluster_is_dropped(self):
        clusters, centers = kmeans([[0, 0], [1, 1]], [[0, 0], [100, 100]], chebyshev)
        self.assertEqual(clusters, [[0, 1]])
        self.assertEqual(centers, [[0.5, 0.5]])

    def test_centers_are_json_serializable(self):
        # the map centers are sent to the print server as JSON
        _, centers = kmeans([[0, 0], [2, 2]], [[0, 0]], chebyshev)
        self.assertEqual(json.loads(json.dumps(centers)), [[1.0, 1.0]])


if __name__ == "__main__":
    unittest.main()
