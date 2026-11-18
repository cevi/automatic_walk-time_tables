import unittest

from swiss_TML_api.name_finding.name_ranking import (
    FIELD_NAME,
    HUT,
    JUNCTION,
    LAKE,
    PASS,
    SPOT_HEIGHT,
    STOP,
    classify,
    is_lake,
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
        self.assertFalse(is_lake("Weggabelung Route du Lac", "Weggabelung"))

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
        self.assertIs(classify("Daubensee", "Flurname swisstopo"), LAKE)
        self.assertIs(classify("Lej da Segl", "Flurname swisstopo"), LAKE)
        self.assertIs(classify("Seematt", "Flurname swisstopo"), FIELD_NAME)

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
        self.assertIsNone(best(("Punkt 545", "Kotierter Punkt", 11)))


if __name__ == "__main__":
    unittest.main()
