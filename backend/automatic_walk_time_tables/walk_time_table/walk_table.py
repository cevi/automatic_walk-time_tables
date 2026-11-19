import logging
import os
from datetime import timedelta, datetime
from math import log
from multiprocessing import Process
from matplotlib import pyplot as plt
import copy

import requests

import openpyxl
from openpyxl.styles import Font
from openpyxl.worksheet.pagebreak import Break

from automatic_walk_time_tables.utils import path, error
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV03

logger = logging.getLogger(__name__)

GOTENBERG_URL = os.environ.get("GOTENBERG_URL", "")
"""Gotenberg (https://gotenberg.dev), which prints the walk-time table as PDF with LibreOffice."""

WAY_POINTS_PER_PAGE = 21
"""Rows of the J+S template (one A4 page): the data rows 8 to 28."""
MAX_WAY_POINTS = 2 * WAY_POINTS_PER_PAGE
"""A longer table continues on further A4 pages, see extend_table."""

FIRST_ROW = 8
TEMPLATE_SUMS_ROW = FIRST_ROW + WAY_POINTS_PER_PAGE
TEMPLATE_LAST_ROW = 52
"""The last row of the print area (below the sums is the elevation profile chart)."""


def _row_formulas(row: int) -> dict:
    """The formulas of a data row of the J+S template (row 9 onwards), for the given row."""
    prev = row - 1
    return {
        "D": (f'=IF(A{row}="",0,IF(C{row}>0,(C{row}-C{prev})/100,0))', "0.00"),
        "F": (
            f'=IF(A{row}="",0,IF(J{row}<-20,-D{row}/1.5+E{row},IF(J{row}<0,E{row},D{row}+E{row})))',
            "0.0",
        ),
        "G": (f'=IF(A{row}="",0,TIME(0,60/$N$3*F{row},0))', "h:mm"),
        "H": (f"=H{prev}+E{row}", "0.0"),
        "I": (f"=I{prev}+F{row}", "0.0"),
        "J": (f"=IF(E{row}=0,0,D{row}/(10*E{row})*100)", "0.0"),
        "K": (f"=K{prev}+G{row}+M{row}", "hh:mm"),
    }


def extend_table(sheet, number_of_way_points: int) -> None:
    """
    Makes room for more way points than the template has rows (21): the rows below the table (sums and
    elevation profile) move down, the new rows get the formulas and the style of the template rows, and the
    table is printed on several A4 pages with the header rows (1 to 7) repeated on every page.
    """
    extra = number_of_way_points - WAY_POINTS_PER_PAGE
    if extra <= 0:
        return

    last_row = FIRST_ROW + number_of_way_points - 1
    sums_row = last_row + 1

    heights = {
        r: sheet.row_dimensions[r].height
        for r in range(TEMPLATE_SUMS_ROW, TEMPLATE_LAST_ROW + 1)
    }
    sheet.move_range(
        f"A{TEMPLATE_SUMS_ROW}:N{TEMPLATE_LAST_ROW}", rows=extra, translate=True
    )
    for r, height in heights.items():
        sheet.row_dimensions[r + extra].height = height
    for chart in sheet._charts:
        chart.anchor._from.row += extra
        chart.anchor.to.row += extra

    template_row = TEMPLATE_SUMS_ROW - 1
    for r in range(TEMPLATE_SUMS_ROW, sums_row):
        sheet.row_dimensions[r].height = sheet.row_dimensions[template_row].height
        for c in range(1, 15):
            sheet.cell(r, c)._style = copy.copy(sheet.cell(template_row, c)._style)
        for col, (formula, number_format) in _row_formulas(r).items():
            sheet[f"{col}{r}"] = formula
            sheet[f"{col}{r}"].number_format = number_format

    # the sums cover all rows (moving them translated the ranges instead of extending them)
    sheet[f"G{sums_row}"] = f"=SUM(G{FIRST_ROW}:G{last_row}) +M{sums_row}"
    sheet[f"H{sums_row}"] = f"=MAX(H{FIRST_ROW + 1}:H{last_row})"
    sheet[f"I{sums_row}"] = f"=MAX(I{FIRST_ROW + 1}:I{last_row})"
    sheet[f"M{sums_row}"] = f"=SUM(M{FIRST_ROW}:M{last_row})"

    # the elevation profile shows all way points
    for chart in sheet._charts:
        for series in chart.series:
            if series.xVal is not None and series.xVal.numRef is not None:
                series.xVal.numRef.f = f"'{sheet.title}'!$H${FIRST_ROW}:$H${last_row}"
            if series.yVal is not None and series.yVal.numRef is not None:
                series.yVal.numRef.f = f"'{sheet.title}'!$C${FIRST_ROW}:$C${last_row}"

    # print on A4 pages of 21 way points each, the header rows on every page
    sheet.print_title_rows = "1:7"
    sheet.print_area = f"A1:N{TEMPLATE_LAST_ROW + extra}"
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    for page_end in range(TEMPLATE_SUMS_ROW - 1, last_row, WAY_POINTS_PER_PAGE):
        sheet.row_breaks.append(Break(id=page_end))
    sheet.oddFooter.center.text = "Seite &P von &N"


def plot_elevation_profile(
    path_: path.Path,
    way_points: path.Path,
    pois: path.Path,
    file_name: str,
    legend_position: str,
):
    """
    Plots the elevation profile of the path contained in the GPX-file. In addition, the
    plot contains the approximated elevation profile by the way_points.
    Saves the plot as an image in the ./output directory as an image called {{file_name}}<.png
    """

    p = Process(
        target=_plot_elevation_profile,
        args=(file_name, legend_position, path_, pois, way_points),
    )
    p.start()
    p.join()

    if p.exitcode != 0:
        logger.error(
            "Plotting the elevation profile failed with exit code %s", p.exitcode
        )


def _plot_elevation_profile(file_name, legend_position, path_, pois, way_points):
    # clear the plot, plot heights of exported data from SchweizMobil
    plt.clf()
    distances = [p.accumulated_distance for p in path_.way_points]
    heights = [p.point.h for p in path_.way_points]
    plt.plot([d / 1_000.0 for d in distances], heights, label="Wanderweg", zorder=1)
    # resize plot area
    # the +1 keeps the logarithm defined for flat routes (all heights are equal)
    additional_space = log(max(heights) - min(heights) + 1) * 25
    plt.ylim(ymax=max(heights) + additional_space, ymin=min(heights) - additional_space)
    # add way_points to plot
    plt.plot(
        [p.accumulated_distance / 1_000.0 for p in way_points.way_points],
        [p.point.h for p in way_points.way_points],
        label="Marschzeittabelle",
        zorder=2,
    )
    plt.scatter(
        [p.accumulated_distance / 1_000.0 for p in pois.way_points],
        [p.point.h for p in pois.way_points],
        c="lightblue",
        zorder=1,
        label="Points of Interest",
    )
    plt.scatter(
        [p.accumulated_distance / 1_000.0 for p in way_points.way_points],
        [p.point.h for p in way_points.way_points],
        c="orange",
        s=15,
        zorder=4,
        label="Wegpunkte",
    )
    # Check difference between the length of the original path and the length of the way points
    logger.info(
        "way_points = {} | distances = {}".format(
            way_points.way_points[-1].accumulated_distance, distances[-1]
        )
    )
    assert (
        abs(way_points.way_points[-1].accumulated_distance - distances[-1]) <= 250
    )  # max diff 250 meters
    # labels
    plt.ylabel("Höhe [m ü. M.]")
    plt.xlabel("Distanz [km]")
    plt.title("Höhenprofil", fontsize=20)
    plt.legend(loc=legend_position, frameon=False)
    # Grid
    plt.grid(color="gray", linestyle="dashed", linewidth=0.5)
    # Check if output directory exists, if not, create it.
    if not os.path.exists("output"):
        os.mkdir("output")
    # show the plot and save image
    plt.savefig(file_name + "_elevation_profile.png", dpi=750)
    logger.info(
        "Elevation profile plot saved as " + file_name + "_elevation_profile.png"
    )


def create_walk_table(
    time_stamp_iso,
    speed,
    way_points: Path,
    file_name: str,
    route_name: str,
    creator_name: str,
    map_numbers: str,
    number_points: bool = False,
):
    """

    Saves the Excel file as .output/Marschzeittabelle_{{file_name}}.xlsx'

    If number_points is set, every location gets the number it carries on the map
    as a prefix, e.g. "3: Uto Kulm".

    """
    # print the current path to debug
    try:
        xfile = openpyxl.load_workbook(
            "automatic_walk_time_tables/res/Marschzeit_Template.xlsx"
        )
    except:
        try:
            xfile = openpyxl.load_workbook("res/Marschzeit_Template.xlsx")
        except:
            logger.error("Could not find template file for walk table.")
            raise FileNotFoundError
    time_stamp = datetime.fromisoformat(time_stamp_iso)

    sheet = xfile.worksheets[0]
    oldPoint = None
    time = 0

    logger.debug(
        "                                          Geschwindigkeit: "
        + str(speed)
        + "km/h\n"
    )
    logger.debug(
        "Distanz Höhe           Zeit   Uhrzeit     Ort (Koordinaten und Namen)"
    )

    sheet["A6"] = map_numbers
    sheet["B2"] = route_name
    sheet["B3"] = time_stamp.strftime("%d.%m.%Y")
    sheet["B4"] = creator_name
    sheet["N3"] = speed
    sheet["K8"] = time_stamp.strftime("%H:%M")

    # get infos about points
    if len(way_points.way_points) > MAX_WAY_POINTS:
        logger.error("Too many waypoints.")
        raise error.UserException(
            f"Zu viele Wegpunkte im Excel vorhanden (maximal {MAX_WAY_POINTS})."
        )
    extend_table(sheet, len(way_points.way_points))

    for i, pt in enumerate(way_points.way_points):
        lv95: Point_LV95 = pt.point.to_LV95()

        # calc time
        deltaTime = 0.0
        if oldPoint is not None:
            deltaTime = calc_walk_time(
                pt.point.h - oldPoint.point.h,
                abs(oldPoint.accumulated_distance - pt.accumulated_distance),
                speed,
            )
        time += deltaTime

        time_stamp = time_stamp + timedelta(hours=deltaTime)

        logger.debug(
            str(
                round(
                    abs(
                        (oldPoint.accumulated_distance if oldPoint is not None else 0.0)
                        - pt.accumulated_distance
                    ),
                    1,
                )
            )
            + "km "
            + str(int(lv95.h))
            + "m ü. M. "
            + str(round(deltaTime, 1))
            + "h "
            + time_stamp.strftime("%H:%M")
            + "Uhr "
            + str((int(lv95.lat), int(lv95.lon)))
            + " "
            + pt.name
        )

        location = (
            pt.name
            if pt.name
            else "(" + str(int(lv95.lat)) + ", " + str(int(lv95.lon)) + ")"
        )
        if number_points:
            location = str(i + 1) + ": " + location
        sheet["A" + str(8 + i)] = location

        sheet["C" + str(8 + i)] = int(lv95.h)

        if hasattr(pt, "break_duration") and pt.break_duration:
            duration = 0
            try:
                if ":" in str(pt.break_duration):
                    parts = str(pt.break_duration).split(":")
                    duration = int(parts[0]) * 60 + int(parts[1])
                else:
                    duration = float(pt.break_duration)
            except Exception:
                duration = 0

            if duration > 0:
                sheet["M" + str(8 + i)] = duration / 1440.0
                sheet["M" + str(8 + i)].number_format = "h:mm"
        if i > 0:
            sheet["E" + str(8 + i)] = (
                round(
                    abs(
                        (oldPoint.accumulated_distance if oldPoint is not None else 0.0)
                        - pt.accumulated_distance
                    ),
                    1,
                )
                / 1_000.0
            )

        oldPoint = pt

    logger.debug(
        "--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---"
    )
    logger.debug(
        str(round(way_points.total_distance, 1)) + "km " + str(round(time, 1)) + "h"
    )
    logger.debug(
        "=== === === === === === === === === === === === === === === === === === ==="
    )

    # Check if output directory exists, if not, create it.
    if not os.path.exists("output"):
        os.mkdir("output")

    # the font of the title (Frutiger) is rarely installed, the rest of the sheet uses Arial
    sheet["A1"].font = Font(name="Arial", size=sheet["A1"].font.size, bold=True)

    xfile.save(file_name + "_Marschzeittabelle.xlsx")

    logger.info("Marschzeittabelle saved as " + file_name + "_Marschzeittabelle.xlsx")

    convert_to_pdf(file_name + "_Marschzeittabelle.xlsx")


def convert_to_pdf(xlsx_file: str, timeout: int = 60):
    """
    Saves a PDF version of the walk-time table next to the Excel file (same name, .pdf), printed by LibreOffice
    in the Gotenberg service: the formulas are calculated and the print settings of the template (A4 pages,
    header rows on every page) apply. Returns the path of the PDF, or None if no PDF was created; the export
    goes on without the PDF in that case.
    """
    if not GOTENBERG_URL:
        logger.warning(
            "GOTENBERG_URL is not set, the walk-time table is not exported as PDF."
        )
        return None

    pdf_file = os.path.splitext(xlsx_file)[0] + ".pdf"
    try:
        with open(xlsx_file, "rb") as f:
            response = requests.post(
                GOTENBERG_URL.rstrip("/") + "/forms/libreoffice/convert",
                files={"files": (os.path.basename(xlsx_file), f)},
                timeout=timeout,
            )
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error("Converting the walk-time table to PDF failed: %s", e)
        return None

    with open(pdf_file, "wb") as f:
        f.write(response.content)
    logger.info("Marschzeittabelle saved as %s", pdf_file)
    return pdf_file


def calc_walk_time(delta_height, delta_dist, speed):
    """

    Calculates the walking time form one point to another

    for this calculation the basic formula form Jugend+Sport is used for preciser we could use the formula
    form SchweizMobil or use more way points. But since we want to create a "normal" walk table as specified by
    Jugend+Sport we use there basic formula

    """

    if delta_height is None or delta_dist is None:
        return 0

    return leistungskilometer(delta_height, delta_dist) / speed


def leistungskilometer(delta_height, delta_dist):
    """
    Leistungskilometer as in the J+S template (column F): 1 Lkm = 1 km distance = 100 m ascent;
    on a descent steeper than 20 %, 150 m of descent count as 1 Lkm. Distances in m, heights in m.
    """
    dist_km = delta_dist / 1_000.0
    gradient = delta_height / delta_dist * 100 if delta_dist else 0
    if gradient < -20:
        return dist_km - delta_height / 150
    if gradient < 0:
        return dist_km
    return dist_km + max(delta_height, 0) / 100
