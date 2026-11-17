import importlib.util
import unittest

from swiss_TML_api.name_finding.name_lookup import pretty_name
from swiss_TML_api.name_finding.name_ranking import CROSSING, NAMED_CROSSING, classify

HAS_GEO = all(importlib.util.find_spec(m) for m in ("shapely", "fiona"))


class BridgeNameTest(unittest.TestCase):
    def test_pretty_names(self):
        self.assertEqual(pretty_name("Bruecke (Linth)"), "Brücke (Linth)")
        self.assertEqual(pretty_name("Bruecke (Wanderweg)"), "Brücke")
        self.assertEqual(pretty_name("Bruecke mit Treppe"), "Brücke mit Treppe")
        self.assertEqual(pretty_name("Unterfuehrung"), "Unterführung")
        self.assertEqual(pretty_name("Weggabelung bei X"), "Weggabelung bei X")

    def test_bridge_named_after_a_river_ranks_above_a_junction(self):
        self.assertIs(classify("Bruecke (Linth)", "Bruecke"), NAMED_CROSSING)
        self.assertIs(classify("Bruecke", "Bruecke"), CROSSING)
        self.assertIs(classify("Bruecke (Wanderweg)", "Bruecke"), CROSSING)


@unittest.skipUnless(HAS_GEO, "needs shapely and fiona (swiss_TLM_api image)")
class BridgePointsTest(unittest.TestCase):
    def setUp(self):
        from shapely.geometry import LineString

        from swiss_TML_api.name_finding.index_builder.bridges import (
            bridge_name,
            bridge_points,
        )

        self.LineString, self.bridge_points, self.bridge_name = (
            LineString,
            bridge_points,
            bridge_name,
        )

    def test_bridge_is_put_where_it_crosses_the_river(self):
        bridge = self.LineString([(0, 0), (40, 0)])
        river = self.LineString([(30, -50), (30, 50)])
        self.assertEqual(
            self.bridge_points(bridge, [(river, "Linth")]), [(30, 0, "Linth")]
        )
        self.assertEqual(self.bridge_name("Bruecke", "Linth"), "Bruecke (Linth)")

    def test_bridge_without_river_is_put_in_the_middle(self):
        bridge = self.LineString([(0, 0), (40, 0)])
        river = self.LineString([(60, -50), (60, 50)])
        self.assertEqual(
            self.bridge_points(bridge, [(river, "Linth")]), [(20, 0, None)]
        )
        self.assertEqual(self.bridge_name("Bruecke", None), "Bruecke")


if __name__ == "__main__":
    unittest.main()
