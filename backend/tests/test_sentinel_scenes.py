import unittest
from datetime import datetime, timezone

from automatic_walk_time_tables.sentinel_scenes import (
    Scene,
    footprint_km2,
    select_scenes,
)

NOW = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)
LARGE, STRIP = 63461, 4214  # bounding boxes of a main orbit and a border strip


def scene(day: str, clear_ratio: float, footprint: float = LARGE) -> Scene:
    return Scene(
        id=f"2026-{day}t102000",
        datetime=f"2026-{day}T10:20:00Z",
        url="",
        metadata_url="",
        footprint_km2=footprint,
        clear_ratio=clear_ratio,
    )


def days(scenes):
    return [s.id[5:10] for s in scenes]


def select(candidates):
    return select_scenes(candidates, lambda s: s, NOW)


class SelectScenesTest(unittest.TestCase):
    def test_recent_cloud_free_pass_needs_no_fallback(self):
        candidates = [
            scene("11-16", 0.3),
            scene("11-14", 0.9),
            scene("10-27", 1.0),
            scene("10-22", 0.9),
        ]
        self.assertEqual(days(select(candidates)), ["11-14", "10-27", "10-22"])

    def test_cloudy_days_keep_best_recent_pass(self):
        candidates = [
            scene("11-16", 0.35),
            scene("11-15", 0.67, STRIP),  # clearer, but only a border strip
            scene("11-14", 0.73),  # largest cloud-free area in the last 10 days
            scene("10-27", 1.0),
            scene("10-22", 0.87),
            scene("10-12", 0.98),
        ]
        self.assertEqual(days(select(candidates)), ["11-14", "10-27", "10-22"])

    def test_border_strips_are_never_cloud_free_enough(self):
        candidates = [scene("11-12", 1.0, STRIP), scene("10-27", 1.0)]
        self.assertFalse(candidates[0].usable)
        # still shown as the only recent pass, so the map stays up to date
        self.assertEqual(days(select(candidates)), ["11-12", "10-27"])

    def test_no_recent_pass_uses_older_passes(self):
        candidates = [scene("10-27", 1.0), scene("10-22", 0.9)]
        self.assertEqual(days(select(candidates)), ["10-27", "10-22"])

    def test_only_cloudy_passes(self):
        candidates = [scene("11-16", 0.1), scene("11-10", 0.2)]
        self.assertEqual(days(select(candidates)), ["11-10"])

    def test_only_evaluates_needed_passes(self):
        evaluated = []

        def evaluate(s):
            evaluated.append(s.id[5:10])
            return s

        candidates = [scene("11-14", 0.9), scene("10-27", 1.0), scene("10-22", 0.9)]
        candidates += [scene(f"09-{d:02d}", 0.9) for d in range(1, 20)]
        select_scenes(candidates, evaluate, NOW)
        self.assertEqual(evaluated, ["11-14", "11-14", "10-27", "10-22"])


class FootprintTest(unittest.TestCase):
    def test_area_of_one_degree_square_near_bern(self):
        square = {
            "type": "Polygon",
            "coordinates": [[[7, 46.5], [8, 46.5], [8, 47.5], [7, 47.5], [7, 46.5]]],
        }
        self.assertAlmostEqual(footprint_km2(square), 8432, delta=50)
