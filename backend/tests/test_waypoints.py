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

    def test_station_outranks_a_hotel_and_keeps_its_own_name(self):
        path = straight_path(1000)
        mark_landmarks(
            path,
            [
                feature("Gasthof abgelegen", 400, 38, 38, name="Hotel Eggishorn"),
                feature("Uebrige Bahnen", 560, 14, 14, name="Fiescheralp"),
            ],
        )
        lm = landmarks(path)
        self.assertGreater(lm[560].score, lm[400].score)
        self.assertEqual(lm[560].name, "Fiescheralp")

    def test_generic_building_is_no_landmark(self):
        path = straight_path(1000)
        refuge = feature("Gebaeude", 400, name="Refuge")
        refuge["priority"] = 45
        hut = feature("Gebaeude", 700, name="Blattihütte")
        hut["priority"] = 85
        mark_landmarks(path, [refuge, hut])
        self.assertEqual(list(landmarks(path)), [700])

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

    def test_close_way_points_keep_the_more_important_one(self):
        path = straight_path(1000)
        mark_landmarks(path, [feature("Bruecke", 300), feature("Weggabelung", 400)])
        selection = Path()
        for d in (0, 300, 400, 900, 1000):
            selection.append(path.way_points[d // 10])
        thinned = DouglasPeuckerTransformer(min_gap=200).thin_out(selection)
        # 400 is dropped for the bridge (higher score), 900 for the end
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in thinned.way_points],
            [0, 300, 1000],
        )

    def test_fork_is_replaced_by_a_hut_further_on_a_steady_climb(self):
        path = straight_path(2000, height=lambda d: 500 + d / 10)
        mark_landmarks(
            path, [feature("Weggabelung", 600), feature("Gasthof abgelegen", 1000)]
        )
        selection = Path()
        for d in (0, 600, 2000):
            selection.append(path.way_points[d // 10])
        moved = DouglasPeuckerTransformer(min_gap=200).move_to_landmarks(
            selection, path
        )
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in moved.way_points], [0, 1000, 2000]
        )

    def test_highest_point_moves_to_the_pass_next_to_it(self):
        # the elevation model has its maximum 80 m after the pass, 20 m higher
        path = straight_path(
            2000, height=lambda d: 500 + max(0, 100 - abs(d - 600) / 4)
        )
        mark_landmarks(path, [feature("Pass", 520, name="Rotärd")])
        pois = POIsTransformer().transform(path)
        selection = Path()
        for d in (0, 600, 2000):
            selection.append(path.way_points[d // 10])
        moved = DouglasPeuckerTransformer(pois=pois, min_gap=200).move_to_landmarks(
            selection, path
        )
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in moved.way_points], [0, 520, 2000]
        )

    def test_point_on_a_summit_is_not_moved_to_a_hut_below(self):
        # the selected point is the top of a bump; the hut 400 m further is 40 m lower
        path = straight_path(
            2000, height=lambda d: 500 + max(0, 100 - abs(d - 600) / 4)
        )
        mark_landmarks(path, [feature("Gasthof abgelegen", 1000)])
        selection = Path()
        for d in (0, 600, 2000):
            selection.append(path.way_points[d // 10])
        moved = DouglasPeuckerTransformer(min_gap=200).move_to_landmarks(
            selection, path
        )
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in moved.way_points], [0, 600, 2000]
        )

    def test_close_way_points_with_a_height_difference_are_kept(self):
        path = straight_path(1000, height=lambda d: 500 + d / 2)
        selection = Path()
        for d in (0, 100, 1000):
            selection.append(path.way_points[d // 10])
        thinned = DouglasPeuckerTransformer(min_gap=200).thin_out(selection)
        self.assertEqual(thinned.number_of_waypoints, 3)

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

    def test_fixed_point_is_not_replaced_by_a_landmark_next_to_it(self):
        path = straight_path(1000)
        mark_landmarks(path, [feature("Gasthof abgelegen", 420)])
        fixed = Path()
        fixed.append(path.way_points[30])
        selection = Path()
        for d in (0, 300, 420, 1000):
            selection.append(path.way_points[d // 10])
        dp = DouglasPeuckerTransformer(pois=fixed, fixed=fixed, min_gap=200)
        dp.transform(Path([Point_LV95(E, N, 500), Point_LV95(E + 10, N, 600)]))
        thinned = dp.thin_out(selection)
        self.assertIn(
            300, [round(wp.accumulated_distance) for wp in thinned.way_points]
        )

    def test_two_fixed_points_close_together_are_both_kept(self):
        path = straight_path(1000)
        fixed = Path()
        for d in (300, 400):
            fixed.append(path.way_points[d // 10])
        selection = Path()
        for d in (0, 300, 400, 1000):
            selection.append(path.way_points[d // 10])
        thinned = DouglasPeuckerTransformer(
            pois=fixed, fixed=fixed, min_gap=200
        ).thin_out(selection)
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in thinned.way_points],
            [0, 300, 400, 1000],
        )

    def test_fixed_point_before_the_end_is_kept(self):
        path = straight_path(1000)
        fixed = Path()
        fixed.append(path.way_points[90])
        selection = Path()
        for d in (0, 500, 900, 1000):
            selection.append(path.way_points[d // 10])
        thinned = DouglasPeuckerTransformer(
            pois=fixed, fixed=fixed, min_gap=200
        ).thin_out(selection)
        self.assertEqual(
            [round(wp.accumulated_distance) for wp in thinned.way_points],
            [0, 500, 900, 1000],
        )

    def test_gaps_are_filled_even_if_the_longest_cannot_be(self):
        # a long straight stretch drawn with two points only, then a densely sampled stretch
        points = [Point_LV95(E, N, 500), Point_LV95(E + 4000, N, 500)]
        points += [Point_LV95(E + 4000 + d, N, 500) for d in range(10, 3001, 10)]
        path = Path(points)
        selection = Path()
        selection.append(path.way_points[0])
        selection.append(path.way_points[1])
        selection.append(path.way_points[-1])
        filled = DouglasPeuckerTransformer(max_gap=1500).fill_gaps(selection, path)
        dists = [round(wp.accumulated_distance) for wp in filled.way_points]
        self.assertEqual(dists[:2], [0, 4000])
        self.assertLessEqual(max(b - a for a, b in zip(dists[1:], dists[2:])), 1500)

    def test_own_name_carries_the_type_of_the_named_feature(self):
        path = straight_path(1000)
        mark_landmarks(
            path,
            [
                feature("Pass", 500, name="Furkapass"),
                feature("Gebaeude", 503, name="Hotel Belvedere"),
            ],
        )
        lm = landmarks(path)[500]
        self.assertEqual((lm.name, lm.name_type), ("Furkapass", "Pass"))


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

    def test_manual_keeps_the_clicked_position_next_to_a_landmark(
        self, _features, _names
    ):
        # the landmark at 1000 m does not attract a way point clicked 80 m away
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": 1080}, {"x": E + 2500, "y": N}]
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual([w["accumulated_distance"] for w in wps], [1080, 2500])
        self.assertEqual(wps[0]["name"], "Name 1080")

    def test_manual_way_point_at_a_landmark_is_named_after_it(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": 1000}]
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual(wps[0]["name"], "Name 1000")
        self.assertIsNotNone(wps[0]["landmark"])

    def test_manual_adds_start_and_end_on_request(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [
            {"accumulated_distance": 20},
            {"accumulated_distance": 1500},
        ]
        body["include_start_end"] = True
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual([w["accumulated_distance"] for w in wps], [20, 1500, 3000])

    def test_extending_a_route_with_21_way_points_keeps_the_limit(
        self, _features, _names
    ):
        # 21 way points on the first 2 km, the route now goes on to 3 km: the new end must be in, 21 at most
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": d} for d in range(0, 2001, 100)]
        body["include_start_end"] = True
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual(len(wps), 21)
        self.assertEqual(wps[-1]["accumulated_distance"], 3000)

    def test_manual_keeps_the_position_without_radius(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": 1080}]
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual(wps[0]["accumulated_distance"], 1080)

    def test_names(self, _features, _names):
        r = self.client.post("/names", json={"points": [[E + 5, N]]})
        self.assertEqual(r.get_json()["names"][0]["name"], "Name 5")

    def test_manual_without_distance_uses_the_coordinates(self, _features, _names):
        # while drawing, the frontend knows no distances yet
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": None, "x": E + 700, "y": N}]
        wps = self.client.post("/waypoints/manual", json=body).get_json()["waypoints"]
        self.assertEqual(wps[0]["accumulated_distance"], 700)

    def test_missing_route_is_a_bad_request(self, _features, _names):
        self.assertEqual(self.client.post("/waypoints/auto", json={}).status_code, 400)
        self.assertEqual(
            self.client.post("/waypoints/manual", json={"route": "x"}).status_code, 400
        )

    def test_auto_keeps_fixed_distances_and_the_highest_point(self, _features, _names):
        path = straight_path(4000, height=lambda d: 500 + 100 * math.sin(d / 1300))
        body = {**encoded(path), "fixed_distances": [3000, 1000]}
        r = self.client.post("/waypoints/auto", json=body)
        self.assertEqual(r.status_code, 200)
        selected = r.get_json()["waypoints"]
        dists = [round(wp["accumulated_distance"]) for wp in selected]
        self.assertIn(1000, dists)
        self.assertIn(3000, dists)
        # the route starts at its lowest point; the highest point (600 m, rounded in the request) is kept
        self.assertEqual(max(wp["h"] for wp in selected), 600)

    def test_bad_fixed_distances_are_a_bad_request(self, _features, _names):
        body = {**encoded(straight_path(1000)), "fixed_distances": ["a"]}
        self.assertEqual(
            self.client.post("/waypoints/auto", json=body).status_code, 400
        )

    def test_bad_name_points_are_a_bad_request(self, _features, _names):
        for points in ([[1, 2, 3]], ["a"], [[2600000, 1200000]] * 501):
            r = self.client.post("/names", json={"points": points})
            self.assertEqual(r.status_code, 400, points[:1])

    def test_fetched_elevation_is_returned_for_the_next_request(
        self, _features, _names
    ):
        path = straight_path(1000)
        body = {"route": encoded(path)["route"]}
        with mock.patch(
            "app.HeightFetcherTransformer.transform", return_value=path
        ) as fetch:
            r = self.client.post("/waypoints/auto", json=body)
        self.assertEqual(r.status_code, 200)
        fetch.assert_called_once()
        self.assertEqual(r.get_json()["elevation"], encoded(path)["elevation"])
        # with elevation, nothing is fetched and nothing is returned
        r = self.client.post("/waypoints/auto", json=encoded(path))
        self.assertNotIn("elevation", r.get_json())

    def test_unavailable_elevation_service_is_a_temporary_error(
        self, _features, _names
    ):
        from automatic_walk_time_tables.utils.error import ElevationServiceUnavailable

        body = {"route": encoded(straight_path(1000))["route"], "waypoints": []}
        with mock.patch(
            "app.HeightFetcherTransformer.transform",
            side_effect=ElevationServiceUnavailable(),
        ):
            for endpoint in ("/waypoints/auto", "/waypoints/manual"):
                r = self.client.post(endpoint, json=body)
                self.assertEqual(r.status_code, 503, endpoint)

    def test_way_point_without_position_is_a_bad_request(self, _features, _names):
        body = encoded(straight_path(3000))
        body["waypoints"] = [{"accumulated_distance": None}]
        self.assertEqual(
            self.client.post("/waypoints/manual", json=body).status_code, 400
        )


if __name__ == "__main__":
    unittest.main()
