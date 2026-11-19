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

    def test_fork_named_after_a_single_street_uses_a_nearer_hamlet(self):
        # Stadel ZH: the fork lies at the hamlet Lettenhof (60 m), the field name Oberer Lätten is 84 m away
        self.assertEqual(
            name_at(
                obj("Weggabelung Bachserstrasse", "Weggabelung"),
                obj("Oberer Lätten", "Flurname swisstopo", 1, 84),
                obj("Lettenhof", "Ort", 0, -60),
            ),
            "Weggabelung bei Lettenhof",
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

    def test_remote_inn_is_a_hut_and_beats_the_field_name_at_the_point(self):
        self.assertEqual(
            name_at(
                obj("Bättmer-Hitta", "Gasthof abgelegen", 12),
                obj("Mossji", "Flurname swisstopo", 11),
                obj("Weggabelung bei Mossji", "Weggabelung", 60),
            ),
            "Bättmer-Hitta",
        )

    def test_inn_nearby_does_not_rename_a_junction_or_a_station(self):
        self.assertEqual(
            name_at(
                obj("Gemmi Lodge", "Gasthof abgelegen", 30),
                obj("Weggabelung bei Platten", "Weggabelung"),
            ),
            "Weggabelung bei Platten",
        )
        self.assertEqual(
            name_at(
                obj("Alpenlodge Kühboden", "Gasthof abgelegen", 35),
                obj("Fiescheralp", "Uebrige Bahnen", 5),
            ),
            "Fiescheralp",
        )

    def test_inn_named_as_a_hut_is_a_hut(self):
        self.assertEqual(
            name_at(
                obj("Lämmerenhütte", "Gasthof abgelegen", 150),
                obj("Weggabelung bei X", "Weggabelung"),
            ),
            "Lämmerenhütte",
        )

    def test_named_hut_beats_the_spot_height_next_to_it(self):
        self.assertEqual(
            name_at(
                obj("Punkt 2026", "Kotierter Punkt"),
                obj("Blattihütte", "Gebaeude", 25),
            ),
            "Blattihütte",
        )
        self.assertEqual(
            name_at(
                obj("Weggabelung bei X", "Weggabelung"),
                obj("Refuge de la Christine", "Gebaeude", 50),
            ),
            "Refuge de la Christine",
        )

    def test_small_hut_far_away_does_not_rename_a_junction(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung bei Chrutoose", "Weggabelung"),
                obj("Chrotthütte", "Gebaeude", 157),
            ),
            "Weggabelung bei Chrutoose",
        )

    def test_official_name_of_an_object_with_several_names(self):
        joined = "Matterhorn | Mont Cervin | Monte Cervino"
        candidates = [
            obj("Mont Cervin", "Alpiner Gipfel"),
            obj("Monte Cervino", "Alpiner Gipfel"),
            obj(joined, "Alpiner Gipfel"),
            obj("Matterhorn", "Alpiner Gipfel"),
        ]
        self.assertEqual(name_at(*candidates), "Matterhorn")
        self.assertEqual(
            name_at(
                obj(
                    "Passo del San Gottardo | Gotthardpass | Col du St-Gothard",
                    "Pass",
                )
            ),
            "Passo del San Gottardo",
        )

    def test_covered_bridge_is_a_bridge(self):
        self.assertEqual(
            name_at(obj("Gedeckte Bruecke (Emme)", "Gedeckte Bruecke")),
            "Gedeckte Brücke (Emme)",
        )

    def test_junction_beats_an_object_named_after_its_kind(self):
        for kind in ("Bildstock", "Brunnen", "Wasserfall"):
            self.assertEqual(
                name_at(obj(kind, kind, 2), obj("Kreuzung A, B", "Kreuzung", 5)),
                "Kreuzung A, B",
                kind,
            )
        self.assertEqual(
            name_at(
                obj("Staubbachfall", "Wasserfall", 10),
                obj("Weggabelung bei X", "Weggabelung"),
            ),
            "Staubbachfall",
        )

    def test_bare_refuge_is_no_landmark(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung bei X", "Weggabelung"),
                obj("Refuge", "Gebaeude", 30),
            ),
            "Weggabelung bei X",
        )

    def test_field_name_with_hut_word_is_no_hut(self):
        for field_name in ("Ziegelhütte", "Hüttenboden", "Champ du Sac"):
            self.assertEqual(
                name_at(
                    obj("Kreuzung A, B", "Kreuzung"),
                    obj(field_name, "Flurname swisstopo", 180),
                ),
                "Kreuzung A, B",
                field_name,
            )

    def test_club_hut_field_name_is_a_hut(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung bei X", "Weggabelung"),
                obj("Fründenhütte SAC", "Flurname swisstopo", 150),
            ),
            "Fründenhütte SAC",
        )

    def test_hut_word_must_end_the_word(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung bei X", "Weggabelung"),
                obj("Restaurant Hüttenberg", "Gasthof abgelegen", 150),
            ),
            "Weggabelung bei X",
        )
        self.assertEqual(
            name_at(
                obj("Weggabelung bei X", "Weggabelung"),
                obj("Niwi Hitta", "Gebaeude", 50),
            ),
            "Niwi Hitta",
        )

    def test_generic_forest_hut_does_not_take_over_the_name(self):
        self.assertEqual(
            name_at(
                obj("Weggabelung bei X", "Weggabelung"),
                obj("Waldhütte", "Gebaeude", 60),
            ),
            "Weggabelung bei X",
        )

    def test_no_name_without_an_object_close_enough(self):
        result = find_name([obj("Ob der Hueb", "Flurname swisstopo", 180)], E, N)
        self.assertEqual(result["swiss_name"], "")
        self.assertEqual(result["alternatives"], [])

    def test_spot_height_at_a_bus_stop_names_the_point(self):
        # bus stop names are not printed on the map, the spot height is
        self.assertEqual(
            name_at(
                obj("Banco, Paese", "Haltestelle Bus", 2),
                obj("Punkt 584", "Kotierter Punkt", 9),
                obj("Banco", "Siedlung", 80),
                obj("I Vignòo", "Flurname swisstopo", 40),
            ),
            "Punkt 584 (Banco)",
        )
        self.assertEqual(
            name_at(obj("Banco, Paese", "Haltestelle Bus", 2)), "Banco, Paese"
        )

    def test_spot_height_prefers_a_place_name(self):
        self.assertEqual(
            name_at(
                obj("Punkt 415", "Kotierter Punkt"),
                obj("Castelrotto", "Siedlung", 160),
                obj("Luzzo", "Flurname swisstopo", 90),
            ),
            "Punkt 415 (Castelrotto)",
        )

    def test_small_lake_without_height(self):
        self.assertEqual(
            name_at(
                obj("Stadlersee", "See", 0, 20),
                obj("Weggabelung Hochfelderstrasse", "Weggabelung"),
                obj("Obem See", "Flurname swisstopo", 150, 70),
            ),
            "Stadlersee",
        )

    def test_alternatives_are_the_next_best_other_names(self):
        result = find_name(
            [
                obj("Weggabelung bei Unter Stock", "Weggabelung", 1),
                obj("Stock", "Haupthuegel", 50, 15),
                obj("Weggabelung bei Unter Stock", "Weggabelung", 48),
            ],
            E,
            N,
        )
        self.assertEqual(result["swiss_name"], "Weggabelung bei Unter Stock")
        self.assertEqual([a["swiss_name"] for a in result["alternatives"]], ["Stock"])

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

    def test_long_route_finds_features_in_every_chunk_of_segments(self):
        # 100 segments of 10 m: several index queries, each feature found once with its distance to the route
        objects = [obj(f"F{d}", "Weggabelung", d, 3) for d in (5, 195, 200, 205, 995)]
        calls = []

        def query_bbox(e0, n0, e1, n1):
            calls.append((e0, e1))
            return [o for o in objects if e0 <= o.x <= e1 and n0 <= o.y <= n1]

        route = [[E + d, N] for d in range(0, 1001, 10)]
        features = features_along_route(route, query_bbox, corridor=25)
        self.assertEqual(
            sorted(f["name"] for f in features), ["F195", "F200", "F205", "F5", "F995"]
        )
        self.assertTrue(all(f["offset"] == 3.0 for f in features))
        self.assertLess(len(calls), 10)

    def test_objects_with_names_in_several_languages_have_their_official_name(self):
        # the landmarks of the waypoint selection are named after themselves: no translations, no joined names
        objects = [
            obj(
                "Passo del San Gottardo | Gotthardpass | Pass dal Son Gottard",
                "Pass",
                100,
            ),
            obj("Gotthardpass", "Pass", 100),
            obj("Pass dal Son Gottard", "Pass", 100),
            obj("Passo del San Gottardo", "Pass", 100),
        ]

        def query_bbox(e0, n0, e1, n1):
            return [o for o in objects if e0 <= o.x <= e1 and n0 <= o.y <= n1]

        features = features_along_route([[E, N], [E + 300, N]], query_bbox)
        self.assertEqual({f["name"] for f in features}, {"Passo del San Gottardo"})


if __name__ == "__main__":
    unittest.main()
