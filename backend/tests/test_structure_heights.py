import unittest

import numpy as np

from automatic_walk_time_tables.path_transformers.structure_heights import (
    correct_heights,
)

DIST = np.arange(0, 1001, 10, dtype=float)


def profile(f):
    return np.array([f(d) for d in DIST], dtype=float)


class CorrectHeightsTest(unittest.TestCase):
    def test_high_bridge_spans_the_gorge(self):
        # flat path at 1000 m, gorge 60 m deep between 450 and 550 m, bridge deck at 1000 m
        h = profile(lambda d: 1000 - (60 if 450 < d < 550 else 0))
        corrected = correct_heights(DIST, h, [(50, True, 1000)])
        self.assertTrue(np.allclose(corrected, 1000))

    def test_tunnel_cuts_through_the_hump(self):
        # tunnel at 1400 m under a 35 m hump between 300 and 400 m
        h = profile(lambda d: 1400 + (35 if 300 < d < 400 else 0))
        corrected = correct_heights(DIST, h, [(35, False, 1400)])
        self.assertTrue(np.allclose(corrected, 1400))

    def test_footbridge_at_the_bottom_of_a_descent_is_unchanged(self):
        # the path really goes down into the ravine; the footbridge is at the bottom (deck = terrain)
        h = profile(lambda d: 1000 - min(d, 1000 - d) / 5)
        corrected = correct_heights(DIST, h, [(50, True, float(h[50]))])
        self.assertTrue(np.allclose(corrected, h))

    def test_nothing_is_changed_if_the_ends_are_not_found(self):
        # the deck is 50 m above the profile everywhere around: the data do not match
        h = profile(lambda d: 1000)
        corrected = correct_heights(DIST, h, [(50, True, 1050)])
        self.assertTrue(np.allclose(corrected, h))


if __name__ == "__main__":
    unittest.main()
