import math
import unittest
from unittest import mock

import polyline

from automatic_walk_time_tables.path_transformers.douglas_peucker_transformer import (
    DouglasPeuckerTransformer,
)
from automatic_walk_time_tables.path_transformers.landmarks import (
    COMBO_BONUS,
    TURN_BONUS,
    WEIGHTS,
    mark_landmarks,
)
from automatic_walk_time_tables.path_transformers.pois_transfomer import POIsTransformer
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV95

E, N = 2_600_000, 1_200_000


def straight_path(length=5000, step=10, height=lambda d: 500.0):
    """A path heading east, with a point every `step` meters."""
    return Path([Point_LV95(E + d, N, height(d)) for d in range(0, length + 1, step)])


def feature(object_type, d, offset=0.0, dn=0.0, name="x"):
    return {
        "name": name,
        "object_type": object_type,
        "e": E + d,
        "n": N + dn,
        "h": 500,
        "offset": offset,
    }


def landmarks(path):
    return {
        round(wp.accumulated_distance): wp.landmark
        for wp in path.way_points
        if wp.landmark is not None
    }


class MarkLandmarksTest(unittest.TestCase):
    def test_fork_with_spot_height_is_a_combined_landmark(self):
        path = straight_path(1000)
        mark_landmarks(
            path,
            [feature("Weggabelung", 400), feature("Kotierter Punkt", 403)],
        )
        lm = landmarks(path)
        self.assertEqual(list(lm), [400])
        # placed at the strongest feature (the spot height), plus the bonus for two landmarks at one place
        self.assertEqual(lm[400].score, WEIGHTS["Kotierter Punkt"] + COMBO_BONUS)
        self.assertEqual(lm[400].types, ["Kotierter Punkt", "Weggabelung"])

    def test_field_names_and_far_objects_are_no_landmarks(self):
        path = straight_path(1000)
        mark_landmarks(
            path,
            [
                feature("Flurname swisstopo", 200),
                feature("Bruecke", 500, offset=40, dn=40),
                feature("Bruecke", 700),
            ],
        )
        self.assertEqual(list(landmarks(path)), [700])

    def test_junction_where_the_route_turns_gets_a_bonus(self):
        # east for 500 m, then north
        pts = [Point_LV95(E + d, N, 500) for d in range(0, 501, 10)]
        pts += [Point_LV95(E + 500, N + d, 500) for d in range(10, 501, 10)]
        path = Path(pts)
        mark_landmarks(path, [feature("Weggabelung", 500), feature("Weggabelung", 250)])
        lm = landmarks(path)
        self.assertEqual(lm[500].score, WEIGHTS["Weggabelung"] + TURN_BONUS)
        self.assertEqual(lm[250].score, WEIGHTS["Weggabelung"])


class LandmarkSelectionTest(unittest.TestCase):
    def select(self, path, **kw):
        pois = POIsTransformer().transform(path)
        return [
            round(wp.accumulated_distance)
            for wp in DouglasPeuckerTransformer(pois=pois, **kw)
            .transform(path)
            .way_points
        ]

    def test_without_options_the_selection_is_unchanged(self):
        path = straight_path(5000, height=lambda d: 500 + 30 * math.sin(d / 400))
        before = self.select(path)
        mark_landmarks(path, [feature("Kreuzung", 1200)])
        self.assertEqual(self.select(path), before)

    def test_flat_route_gets_a_point_every_max_gap(self):
        path = straight_path(6000)
        selected = self.select(path, max_gap=1500)
        gaps = [b - a for a, b in zip(selected, selected[1:])]
        self.assertLessEqual(max(gaps), 1500)

    def test_gap_is_filled_with_a_landmark_near_the_middle(self):
        path = straight_path(3000)
        mark_landmarks(path, [feature("Bruecke", 1300), feature("Bruecke", 2400)])
        selection = Path()
        selection.append(path.way_points[0])
        selection.append(path.way_points[-1])
        filled = DouglasPeuckerTransformer(max_gap=2000).fill_gaps(selection, path)
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in filled.way_points],
            [0, 1300, 3000],
        )

    def test_gap_without_landmark_is_filled_in_the_middle(self):
        path = straight_path(3000)
        selection = Path()
        selection.append(path.way_points[0])
        selection.append(path.way_points[-1])
        filled = DouglasPeuckerTransformer(max_gap=1000).fill_gaps(selection, path)
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in filled.way_points],
            [0, 750, 1500, 2250, 3000],
        )

    def test_landmark_is_kept_instead_of_an_equivalent_point(self):
        # two bumps of the same height; there is a landmark only on the second one
        def height(d):
            return (
                500
                + 20 * math.exp(-(((d - 1500) / 150) ** 2))
                + 20 * math.exp(-(((d - 3500) / 150) ** 2))
            )

        path = straight_path(5000, height=height)
        mark_landmarks(path, [feature("Kotierter Punkt", 3520)])
        selected = self.select(path, number_of_waypoints=3, landmark_bonus=20)
        self.assertIn(3520, selected)


def encoded(path):
    pts = [wp.point.to_LV95() for wp in path.way_points]
    return {
        "route": polyline.encode([(p.lat, p.lon) for p in pts], 0),
        "elevation": polyline.encode(
            [(wp.accumulated_distance, wp.point.h) for wp in path.way_points], 0
        ),
    }


def fake_names(coords, timeout=60):
    return [
        {"name": f"Name {round(e) - E}", "object_type": "Weggabelung", "offset": 0}
        for e, n in coords
    ]


@mock.patch(
    "automatic_walk_time_tables.utils.swiss_tlm_api.fetch_names", side_effect=fake_names
)
@mock.patch(
    "automatic_walk_time_tables.utils.swiss_tlm_api.fetch_features_along_route",
    return_value=[feature("Weggabelung", 1000), feature("Kotierter Punkt", 1000)],
)
class WaypointApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import app

        cls.client = app.test_client()

    def test_auto_returns_named_way_points(self, _features, _names):
        body = encoded(
            straight_path(4000, height=lambda d: 500 + 40 * math.sin(d / 600))
        )
        r = self.client.post("/waypoints/auto", json=body)
        self.assertEqual(r.status_code, 200)
        wps = r.get_json()["waypoints"]
        dists = [w["accumulated_distance"] for w in wps]
        self.assertEqual((dists[0], dists[-1]), (0, 4000))
        self.assertLessEqual(max(b - a for a, b in zip(dists, dists[1:])), 1500)
        landmark = next(w for w in wps if w["accumulated_distance"] == 1000)
        self.assertEqual(landmark["name"], "Name 1000")
        self.assertIsNotNone(landmark["landmark"])
        self.assertEqual(wps[0]["x"], E)

    def test_manual_snaps_to_a_landmark_within_the_radius(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": 1080}, {"x": E + 2500, "y": N}]
        body["snap_radius"] = 100
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual([w["accumulated_distance"] for w in wps], [1000, 2500])
        self.assertEqual(wps[0]["name"], "Name 1000")

    def test_manual_adds_start_and_end_on_request(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [
            {"accumulated_distance": 20},
            {"accumulated_distance": 1500},
        ]
        body["include_start_end"] = True
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual([w["accumulated_distance"] for w in wps], [20, 1500, 3000])

    def test_manual_keeps_the_position_without_radius(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": 1080}]
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual(wps[0]["accumulated_distance"], 1080)

    def test_names(self, _features, _names):
        r = self.client.post("/names", json={"points": [[E + 5, N]]})
        self.assertEqual(r.get_json()["names"][0]["name"], "Name 5")

    def test_missing_route_is_a_bad_request(self, _features, _names):
        self.assertEqual(self.client.post("/waypoints/auto", json={}).status_code, 400)
        self.assertEqual(
            self.client.post("/waypoints/manual", json={"route": "x"}).status_code, 400
        )


if __name__ == "__main__":
    unittest.main()
