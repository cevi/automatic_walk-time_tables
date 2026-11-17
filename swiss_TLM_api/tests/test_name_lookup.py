import unittest

from swiss_TML_api.name_finding.name_lookup import find_name
from swiss_TML_api.name_finding.route_features import features_along_route
from swiss_TML_api.name_finding.swiss_name import SwissName

E, N = 2_600_000, 1_200_000


def obj(name, object_type, de=0, dn=0, h=500):
    return SwissName(name, object_type, E + de, N + dn, h)


def name_at(*candidates, de=0, dn=0):
    return find_name(list(candidates), E + de, N + dn)["swiss_name"]


class FindNameTest(unittest.TestCase):
    def test_junction_at_the_point_beats_a_bridge(self):
        self.assertEqual(
            name_at(obj("Bruecke", "Bruecke", 3), obj("Kreuzung A, B", "Kreuzung")),
            "Kreuzung A, B",
        )

    def test_bridge_at_the_point_beats_a_forest_edge(self):
        self.assertEqual(
            name_at(
                obj("Bruecke", "Bruecke", 1),
                obj("Waldrand bei Chräbüel", "Waldrand", 2),
            ),
            "Brücke",
        )

    def test_bridge_names_are_spelled_with_umlauts(self):
        self.assertEqual(name_at(obj("Bruecke (Wanderweg)", "Bruecke")), "Brücke")
        self.assertEqual(name_at(obj("Unterfuehrung", "Unterfuehrung")), "Unterführung")

    def test_fork_named_after_a_single_street_uses_the_field_name(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung Letziweg", "Weggabelung"),
                obj("Ob der Hueb", "Flurname swisstopo", 60),
            ),
            "Weggabelung bei Ob der Hueb",
        )

    def test_fork_keeps_the_street_name_without_a_field_name_nearby(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung Letziweg", "Weggabelung"),
                obj("Ob der Hueb", "Flurname swisstopo", 150),
            ),
            "Weggabelung Letziweg",
        )

    def test_crossing_of_several_streets_is_kept(self):
        self.assertEqual(
            name_at(
                obj("Kreuzung Letziweg, Zürichbergstrasse", "Kreuzung"),
                obj("Ob der Hueb", "Flurname swisstopo", 30),
            ),
            "Kreuzung Letziweg, Zürichbergstrasse",
        )

    def test_spot_height_gets_the_field_name_within_250_m(self):
        self.assertEqual(
            name_at(
                obj("Punkt 1296", "Kotierter Punkt"),
                obj("Grüebliwald", "Flurname swisstopo", 250, 0.3),
            ),
            "Punkt 1296 (Grüebliwald)",
        )

    def test_offset_is_the_distance_to_the_named_object(self):
        result = find_name([obj("Gemmipass", "Pass", 30, 40)], E, N)
        self.assertEqual(result["offset"], 50)
        self.assertEqual(result["object_type"], "Pass")


class FeaturesAlongRouteTest(unittest.TestCase):
    def test_returns_each_feature_close_to_the_route_once(self):
        objects = [
            obj("Weggabelung bei A", "Weggabelung", 100, 5),
            obj("Punkt 501", "Kotierter Punkt", 200, -20),
            obj("Far away", "Flurname swisstopo", 150, 80),
        ]

        def query_bbox(e0, n0, e1, n1):
            return [o for o in objects if e0 <= o.x <= e1 and n0 <= o.y <= n1]

        route = [[E, N], [E + 300, N]]
        features = features_along_route(route, query_bbox, corridor=25)
        self.assertEqual(
            sorted((f["name"], f["offset"]) for f in features),
            [("Punkt 501", 20.0), ("Weggabelung bei A", 5.0)],
        )


if __name__ == "__main__":
    unittest.main()
