import os
import tempfile
import unittest

import openpyxl

from automatic_walk_time_tables.walk_time_table.walk_table import create_walk_table
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV95


def route():
    path = Path([Point_LV95(2_600_000 + d, 1_200_000, 500.0) for d in (0, 1000, 2000)])
    path.way_points[0].name = "Start"
    path.way_points[1].name = ""
    path.way_points[2].name = "Ziel"
    return path


def locations(number_points):
    with tempfile.TemporaryDirectory() as tmp:
        file_name = os.path.join(tmp, "test")
        create_walk_table(
            "2026-11-18T09:00",
            4.0,
            route(),
            file_name=file_name,
            route_name="Test",
            creator_name="Test",
            map_numbers="1091",
            number_points=number_points,
        )
        sheet = openpyxl.load_workbook(file_name + "_Marschzeittabelle.xlsx").active
        return [sheet["A" + str(row)].value for row in (8, 9, 10)]


class TestWalkTableLocations(unittest.TestCase):
    def test_names_without_numbers(self):
        self.assertEqual(
            locations(number_points=False), ["Start", "(2601000, 1200000)", "Ziel"]
        )

    def test_numbers_match_the_map(self):
        self.assertEqual(
            locations(number_points=True),
            ["1: Start", "2: (2601000, 1200000)", "3: Ziel"],
        )


if __name__ == "__main__":
    unittest.main()
