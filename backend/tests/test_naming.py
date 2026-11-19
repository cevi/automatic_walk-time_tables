import unittest
from unittest import mock

from automatic_walk_time_tables.path_transformers.landmarks import Landmark
from automatic_walk_time_tables.path_transformers.naming_transformer import (
    NamingTransformer,
)
from automatic_walk_time_tables.utils import swiss_tlm_api
from automatic_walk_time_tables.utils.point import Point_LV95
from automatic_walk_time_tables.utils.way_point import WayPoint

E, N = 2_600_000, 1_200_000


def way_point(de, h=500.0, landmark=None):
    wp = WayPoint(de, Point_LV95(E + de, N, h))
    wp.landmark = landmark
    return wp


def names(*entries):
    """fetch_names results: (name, object_type, alternatives)."""
    return [
        {"name": n, "object_type": t, "offset": 0, "alternatives": list(a)}
        for n, t, a in entries
    ]


def name_points(way_points, results):
    with mock.patch.object(swiss_tlm_api, "fetch_names", return_value=results):
        NamingTransformer().name_way_points(way_points)
    return [wp.name for wp in way_points]


class FetchNamesTest(unittest.TestCase):
    def fetch(self, *service_names):
        response = mock.Mock()
        response.json.return_value = {"names": list(service_names)}
        with mock.patch("requests.post", return_value=response):
            return swiss_tlm_api.fetch_names([[E, N]] * len(service_names))

    def test_landmark_within_its_radius_keeps_its_name(self):
        # the naming service names a point after a pass 159 m away: before, the backend dropped every name over 100 m
        [r] = self.fetch({"swiss_name": "Sattel", "object_type": "Pass", "offset": 159})
        self.assertEqual(r["name"], "Sattel")

    def test_no_name_from_the_naming_service(self):
        [r] = self.fetch({"swiss_name": "", "object_type": "", "offset": 0})
        self.assertEqual(r["name"], "")
        self.assertEqual(r["alternatives"], [])

    def test_alternatives(self):
        [r] = self.fetch(
            {
                "swiss_name": "Weggabelung bei Unter Stock",
                "object_type": "Weggabelung",
                "offset": 1,
                "alternatives": [
                    {"swiss_name": "Stock", "object_type": "Haupthuegel", "offset": 53},
                    {"swiss_name": "Far", "object_type": "Pass", "offset": 300},
                ],
            }
        )
        self.assertEqual(r["alternatives"], ["Stock"])


class DuplicateNamesTest(unittest.TestCase):
    def test_second_place_with_the_same_name_gets_the_next_best_name(self):
        self.assertEqual(
            name_points(
                [way_point(0), way_point(50, 970)],
                names(
                    ("Weggabelung bei Unter Stock", "Weggabelung", []),
                    ("Weggabelung bei Unter Stock", "Weggabelung", ["Stock"]),
                ),
            ),
            ["Weggabelung bei Unter Stock", "Stock"],
        )

    def test_without_a_free_name_the_height_is_added(self):
        # "Stigelos" would repeat the place of "Weggabelung bei Stigelos"
        self.assertEqual(
            name_points(
                [way_point(0), way_point(284, 803)],
                names(
                    ("Weggabelung bei Stigelos", "Weggabelung", []),
                    ("Weggabelung bei Stigelos", "Weggabelung", ["Stigelos"]),
                ),
            ),
            ["Weggabelung bei Stigelos", "Weggabelung bei Stigelos (803)"],
        )

    def test_same_place_passed_twice_keeps_its_name(self):
        self.assertEqual(
            name_points(
                [way_point(0), way_point(1000), way_point(1, 627)],
                names(
                    ("Punkt 628", "Kotierter Punkt", []),
                    ("Weggabelung bei X", "Weggabelung", []),
                    ("Punkt 628", "Kotierter Punkt", []),
                ),
            ),
            ["Punkt 628", "Weggabelung bei X", "Punkt 628"],
        )


class LandmarkNameTest(unittest.TestCase):
    def test_station_is_named_after_itself(self):
        station = Landmark(90, (E, N), name="Fiescheralp", name_type="Uebrige Bahnen")
        self.assertEqual(
            name_points(
                [way_point(0, landmark=station)],
                names(("Alpenlodge Kühboden", "Gasthof abgelegen", [])),
            ),
            ["Fiescheralp"],
        )

    def test_bus_stop_with_a_spot_height_is_named_after_the_spot_height(self):
        stop = Landmark(90, (E, N), name="Banco, Paese", name_type="Haltestelle Bus")
        self.assertEqual(
            name_points(
                [way_point(0, landmark=stop)],
                names(("Punkt 584 (Banco)", "Kotierter Punkt", [])),
            ),
            ["Punkt 584 (Banco)"],
        )


if __name__ == "__main__":
    unittest.main()
