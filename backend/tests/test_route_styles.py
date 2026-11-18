import unittest

from automatic_walk_time_tables.map_downloader.create_map import (
    DEFAULT_ROUTE_STYLE,
    ROUTE_STYLES,
    MapCreator,
)

BASE_MAP = "ch.swisstopo.pixelkarte-farbe-pk25.noscale"


class TestRouteStyles(unittest.TestCase):
    def test_default_is_classic_look(self):
        creator = MapCreator(None, "uuid", {})
        self.assertEqual(DEFAULT_ROUTE_STYLE, "classic")
        self.assertIs(creator.route_style, ROUTE_STYLES["classic"])
        self.assertEqual(creator.create_map_layer(BASE_MAP, [])["opacity"], 0.85)

    def test_chosen_style_sets_route_and_base_map_opacity(self):
        for name in ["magenta", "highlighter"]:
            creator = MapCreator(None, "uuid", {"route_style": name})
            self.assertIs(creator.route_style, ROUTE_STYLES[name])
            self.assertEqual(creator.create_map_layer(BASE_MAP, [])["opacity"], 1.0)

    def test_unknown_style_falls_back_to_default(self):
        for value in ["neon", None, ""]:
            creator = MapCreator(None, "uuid", {"route_style": value})
            self.assertIs(creator.route_style, ROUTE_STYLES[DEFAULT_ROUTE_STYLE])

    def test_every_style_has_line_symbolizers(self):
        for name, style in ROUTE_STYLES.items():
            self.assertGreater(style["base_map_opacity"], 0, name)
            self.assertTrue(style["symbolizers"], name)
            for symbolizer in style["symbolizers"]:
                self.assertEqual(symbolizer["type"], "line", name)


if __name__ == "__main__":
    unittest.main()
