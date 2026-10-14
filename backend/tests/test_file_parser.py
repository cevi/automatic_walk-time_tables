import os
import pathlib
import tempfile
import unittest
from unittest import mock

from automatic_walk_time_tables.utils.file_parser import GeoFileParser
from automatic_walk_time_tables.walk_time_table.walk_table import (
    _plot_elevation_profile,
)

FIXTURES = pathlib.Path(__file__).parents[2] / "e2e" / "cypress" / "fixtures"


def read_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class KmlFileTest(unittest.TestCase):
    def parse(self, name: str):
        return GeoFileParser(fetch_elevation=False).parse(
            file_content=read_fixture(name), extension="kml"
        )

    def assert_in_switzerland(self, path_):
        for way_point in path_.way_points:
            wgs84 = way_point.point.to_WGS84()
            self.assertTrue(45.5 < wgs84.lat < 48.0, wgs84)
            self.assertTrue(5.5 < wgs84.lon < 11.0, wgs84)

    def test_newline_separated_coordinates(self):
        path_ = self.parse("kml_newline_separated_coordinates.kml")
        self.assertEqual(path_.number_of_waypoints, 20)
        self.assertEqual(path_.route_name, "Route")
        self.assertGreater(path_.total_distance, 2_000)
        self.assert_in_switzerland(path_)

    def test_existing_fixtures(self):
        expected = {
            "test_small.kml": (27, "Drawing"),
            "circular_path.kml": (5, "Drawing"),
            "map_short.kml": (None, "Drawing"),
            "map_many.kml": (None, "Drawing"),
            "not_tested/map_two_lines.kml": (6, None),
            "not_tested/map_three_lines.kml": (6, None),
        }
        for name, (number_of_waypoints, route_name) in expected.items():
            with self.subTest(name=name):
                path_ = self.parse(name)
                self.assertGreater(path_.total_distance, 100)
                self.assert_in_switzerland(path_)
                if number_of_waypoints is not None:
                    self.assertEqual(path_.number_of_waypoints, number_of_waypoints)
                if route_name is not None:
                    self.assertEqual(path_.route_name, route_name)

    def test_swisstopo_app_file_has_elevation(self):
        path_ = self.parse("app_extrashort.kml")
        self.assertTrue(path_.has_elevation_for_all_points())
        self.assertNotEqual(path_.route_name, "Waypoints")

    def test_flipped_coordinates(self):
        content = (
            "<kml><Placemark><LineString><coordinates>"
            "47.3496,8.4920 47.3505,8.4926"
            "</coordinates></LineString></Placemark></kml>"
        )
        path_ = GeoFileParser(fetch_elevation=False).parse(
            file_content=content, extension="kml"
        )
        self.assert_in_switzerland(path_)

    def test_missing_elevation_gets_fetched(self):
        parser = GeoFileParser(fetch_elevation=True)
        with mock.patch.object(
            parser.height_fetcher, "transform", side_effect=lambda p: p
        ) as transform:
            parser.parse(
                file_content=read_fixture("kml_newline_separated_coordinates.kml"),
                extension="kml",
            )
        transform.assert_called_once()


class GpxFileTest(unittest.TestCase):
    def test_gpx_without_elevation(self):
        parser = GeoFileParser(fetch_elevation=True)
        with mock.patch.object(
            parser.height_fetcher, "transform", side_effect=lambda p: p
        ) as transform:
            path_ = parser.parse(
                file_content=read_fixture("gpx_without_elevation.gpx"),
                extension="gpx",
            )
        transform.assert_called_once()
        self.assertEqual(path_.number_of_waypoints, 20)

    def test_flat_route_can_be_plotted(self):
        path_ = GeoFileParser().parse(
            file_content=read_fixture("gpx_flat_constant_elevation.gpx"),
            extension="gpx",
        )
        self.assertTrue(path_.has_elevation_for_all_points())

        with tempfile.TemporaryDirectory() as directory:
            file_name = os.path.join(directory, "flat")
            _plot_elevation_profile(file_name, "lower right", path_, path_, path_)
            self.assertTrue(os.path.isfile(file_name + "_elevation_profile.png"))


if __name__ == "__main__":
    unittest.main()
