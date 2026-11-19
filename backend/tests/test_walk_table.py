import os
import shutil
import tempfile
import unittest
from unittest import mock

import openpyxl
from pypdf import PdfReader

from automatic_walk_time_tables.utils import error
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV95
from automatic_walk_time_tables.utils.way_point import WayPoint
from automatic_walk_time_tables.walk_time_table.walk_table import (
    MAX_WAY_POINTS,
    create_walk_table,
    leistungskilometer,
)


def route(number_of_way_points: int) -> Path:
    path_ = Path()
    for i in range(number_of_way_points):
        point = Point_LV95(lat=2_700_000 + 500 * i, lon=1_200_000, h=500 + 30 * (i % 5))
        path_.append(WayPoint(500.0 * i, point, f"Punkt {i + 1}"))
    return path_


class WalkTableTest(unittest.TestCase):
    def export(self, number_of_way_points: int):
        tmp = tempfile.mkdtemp()
        name = os.path.join(tmp, "test")
        create_walk_table(
            "2026-03-30T08:00",
            4,
            route(number_of_way_points),
            name,
            "Testroute",
            "Test",
            "Spitzmeilen (1154)",
        )
        return openpyxl.load_workbook(name + "_Marschzeittabelle.xlsx").active

    def test_one_page_keeps_the_template(self):
        sheet = self.export(21)
        self.assertEqual(sheet["A28"].value, "Punkt 21")
        self.assertEqual(sheet["A29"].value, "Summen")
        self.assertEqual(sheet["G29"].value, "=SUM(G8:G28) +M29")
        self.assertIsNone(sheet.print_title_rows)

    def test_more_way_points_continue_on_a_second_page(self):
        sheet = self.export(30)

        # every way point has a row with the formulas of the template
        self.assertEqual(sheet["A37"].value, "Punkt 30")
        self.assertEqual(
            sheet["F37"].value,
            '=IF(A37="",0,IF(J37<-20,-D37/1.5+E37,IF(J37<0,E37,D37+E37)))',
        )
        self.assertEqual(sheet["K37"].value, "=K36+G37+M37")
        self.assertEqual(sheet["H29"].value, "=H28+E29")

        # the sums cover all rows
        self.assertEqual(sheet["A38"].value, "Summen")
        self.assertEqual(sheet["G38"].value, "=SUM(G8:G37) +M38")
        self.assertEqual(sheet["H38"].value, "=MAX(H9:H37)")
        self.assertEqual(sheet["M38"].value, "=SUM(M8:M37)")

        # two A4 pages with the header rows on both, the profile shows all way points
        self.assertEqual(sheet.print_title_rows, "$1:$7")
        self.assertEqual([b.id for b in sheet.row_breaks.brk], [28])
        self.assertEqual(sheet.page_setup.fitToHeight, 0)
        series = sheet._charts[0].series[0]
        self.assertTrue(series.xVal.numRef.f.endswith("$H$8:$H$37"))
        self.assertTrue(series.yVal.numRef.f.endswith("$C$8:$C$37"))

    def test_maximum_number_of_way_points(self):
        sheet = self.export(MAX_WAY_POINTS)
        self.assertEqual(
            sheet[f"A{7 + MAX_WAY_POINTS}"].value, f"Punkt {MAX_WAY_POINTS}"
        )
        with self.assertRaises(error.UserException):
            self.export(MAX_WAY_POINTS + 1)


class WalkTablePdfTest(unittest.TestCase):
    def export(self, number_of_way_points: int) -> str:
        name = os.path.join(tempfile.mkdtemp(), "test")
        create_walk_table(
            "2026-03-30T08:00",
            4,
            route(number_of_way_points),
            name,
            "Testroute",
            "Test",
            "Spitzmeilen (1154)",
        )
        return name

    def test_export_without_libreoffice(self):
        # the Excel file is exported even if the PDF cannot be created
        with mock.patch(
            "automatic_walk_time_tables.walk_time_table.walk_table.shutil.which",
            return_value=None,
        ):
            name = self.export(5)
        self.assertTrue(os.path.exists(name + "_Marschzeittabelle.xlsx"))
        self.assertFalse(os.path.exists(name + "_Marschzeittabelle.pdf"))

    @unittest.skipUnless(
        shutil.which("soffice") or shutil.which("libreoffice"),
        "LibreOffice is not installed",
    )
    def test_pdf_version_has_one_page_per_21_way_points(self):
        for number_of_way_points, pages in ((21, 1), (30, 2)):
            name = self.export(number_of_way_points)
            pdf = PdfReader(name + "_Marschzeittabelle.pdf")
            self.assertEqual(len(pdf.pages), pages)
            text = pdf.pages[-1].extract_text()
            self.assertIn(f"Punkt {number_of_way_points}", text)
            self.assertIn("Summen", text)


class LeistungskilometerTest(unittest.TestCase):
    def test_jugend_und_sport_formula(self):
        # 1 Lkm = 1 km = 100 m ascent
        self.assertAlmostEqual(leistungskilometer(100, 1000), 2.0)
        # a moderate descent counts as distance only
        self.assertAlmostEqual(leistungskilometer(-100, 1000), 1.0)
        # a descent steeper than 20 %: 150 m count as 1 Lkm
        self.assertAlmostEqual(leistungskilometer(-300, 1000), 3.0)


def named_route():
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
            named_route(),
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
