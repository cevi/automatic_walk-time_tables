import unittest

from swiss_TML_api.name_finding.name_ranking import (
    FIELD_NAME,
    HUT,
    CROSSING,
    JUNCTION,
    LINE_CROSSING,
    PASS,
    SMALL_LAKE,
    SPOT_HEIGHT,
    STOP,
    classify,
    rank,
)


def best(*candidates):
    """Returns the name of the best candidate, given as (name, object_type, distance)."""
    valid = [
        (rank(classify(name, object_type), distance), name)
        for name, object_type, distance in candidates
        if distance <= classify(name, object_type).max_distance
    ]
    return max(valid)[1] if valid else None


class ClassifyTest(unittest.TestCase):
    def test_street_name_does_not_turn_a_junction_into_a_lake(self):
        self.assertIs(classify("Weggabelung Route du Lac", "Weggabelung"), JUNCTION)

    def test_street_name_does_not_turn_a_junction_into_a_pass(self):
        self.assertIs(
            classify("Kreuzung Museumstrasse, Bahnhofpassage", "Kreuzung"), JUNCTION
        )

    def test_field_name_does_not_turn_a_junction_into_a_hut(self):
        self.assertIs(classify("Weggabelung bei Wigerehütte", "Weggabelung"), JUNCTION)

    def test_lift_station_named_after_a_lake_is_a_stop(self):
        self.assertIs(classify("Riederalp Blausee (Moosfluh)", "Uebrige Bahnen"), STOP)

    def test_pass_is_recognised_by_its_object_type(self):
        self.assertIs(classify("Gemmipass", "Pass"), PASS)
        self.assertIs(classify("Passo del Maloja", "Strassenpass"), PASS)

    def test_keywords_in_names_of_named_objects(self):
        self.assertIs(classify("Lämmerenhütte SAC", "Lokalname swisstopo"), HUT)
        self.assertIs(classify("Seematt", "Flurname swisstopo"), FIELD_NAME)

    def test_field_name_that_sounds_like_a_lake_is_a_field_name(self):
        # "Obem See" (above the lake) at the Stadlersee: a field name, no lake; lakes come from swissNAMES3D_PLY
        self.assertIs(classify("Obem See", "Flurname swisstopo"), FIELD_NAME)
        self.assertIs(classify("Lej da Segl", "Flurname swisstopo"), FIELD_NAME)

    def test_shore_of_a_small_lake(self):
        self.assertIs(classify("Stadlersee", "See"), SMALL_LAKE)

    def test_stream_crossing_without_a_name_is_below_a_junction(self):
        self.assertIs(classify("Gewässerquerung", "Fliessgewaesser"), CROSSING)
        self.assertLess(CROSSING.priority, JUNCTION.priority)
        self.assertIs(
            classify("Gewässerquerung (Riale di Molge)", "Fliessgewaesser"),
            LINE_CROSSING,
        )

    def test_spot_height(self):
        self.assertIs(classify("Punkt 661", "Kotierter Punkt"), SPOT_HEIGHT)
        self.assertIs(classify("Punkt 2242", "Gipfel"), SPOT_HEIGHT)

    def test_missing_name_and_type(self):
        self.assertEqual(classify(None, None).priority, 0)


class RankTest(unittest.TestCase):
    def test_junction_at_the_point_beats_field_name_nearby(self):
        self.assertEqual(
            best(
                ("Titlisblick", "Flurname swisstopo", 105),
                ("Kreuzung Sagenbachstrasse, Hohenrainstrasse", "Kreuzung", 1),
            ),
            "Kreuzung Sagenbachstrasse, Hohenrainstrasse",
        )

    def test_field_name_beats_junction_which_is_not_at_the_point(self):
        self.assertEqual(
            best(
                ("Ischlag", "Flurname swisstopo", 60),
                ("Weggabelung bei Ischlag", "Weggabelung", 22),
            ),
            "Ischlag",
        )

    def test_spot_height_beats_junction_at_the_same_point(self):
        self.assertEqual(
            best(
                ("Weggabelung bei Moosacher", "Weggabelung", 9),
                ("Punkt 448", "Kotierter Punkt", 0),
            ),
            "Punkt 448",
        )

    def test_junction_beats_forest_edge_and_path_end_at_the_same_point(self):
        self.assertEqual(
            best(
                ("Waldrand bei Mettli", "Waldrand", 10),
                ("Wegende Rheinhaldenweg", "Wegende", 2),
                ("Weggabelung Rheinhaldenweg", "Weggabelung", 0),
            ),
            "Weggabelung Rheinhaldenweg",
        )

    def test_stop_names_its_surroundings(self):
        self.assertEqual(
            best(
                ("Zürich, Kreuzplatz", "Haltestelle Bus", 32),
                ("Kreuzung Zollikerstrasse, Forchstrasse", "Kreuzung", 0),
            ),
            "Zürich, Kreuzplatz",
        )

    def test_landmark_wins_over_objects_at_the_point(self):
        self.assertEqual(
            best(
                ("Gemmipass", "Pass", 150),
                ("Weggabelung bei Platten", "Weggabelung", 0),
            ),
            "Gemmipass",
        )

    def test_objects_out_of_range_are_ignored(self):
        self.assertIsNone(best(("Punkt 545", "Kotierter Punkt", 26)))

    def test_spot_height_a_few_meters_off_the_junction_beats_it(self):
        # the way point is named from the junction's point of the index, the printed spot height is 8 to 25 m away
        self.assertEqual(
            best(
                ("Kreuzung Route du Golf, Route de Ballègue", "Kreuzung", 0),
                ("Punkt 846", "Kotierter Punkt", 17),
            ),
            "Punkt 846",
        )

    def test_named_bridge_beats_a_spot_height_beside_it(self):
        self.assertEqual(
            best(
                ("Bruecke (Gantrischsense)", "Bruecke", 0),
                ("Punkt 1310", "Kotierter Punkt", 14),
            ),
            "Bruecke (Gantrischsense)",
        )

    def test_junction_beats_a_stream_crossing_without_a_name(self):
        self.assertEqual(
            best(
                ("Gewässerquerung", "Fliessgewaesser", 3),
                ("Weggabelung bei Schüepenloch", "Weggabelung", 1),
            ),
            "Weggabelung bei Schüepenloch",
        )

    def test_small_lake_beats_junction_and_spot_height_but_not_a_stop(self):
        self.assertEqual(
            best(
                ("Stadlersee", "See", 25),
                ("Weggabelung Hochfelderstrasse", "Weggabelung", 0),
                ("Punkt 418", "Kotierter Punkt", 5),
            ),
            "Stadlersee",
        )
        self.assertEqual(
            best(
                ("Lago della Piazza", "See", 10),
                ("Gotthard Passhöhe", "Haltestelle Bus", 12),
            ),
            "Gotthard Passhöhe",
        )
        self.assertIsNone(best(("Stadlersee", "See", 31)))


if __name__ == "__main__":
    unittest.main()
