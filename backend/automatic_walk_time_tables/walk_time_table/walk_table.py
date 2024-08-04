import logging
import os
from datetime import timedelta, datetime
from math import log
from multiprocessing import Process

import openpyxl

from automatic_walk_time_tables.utils import path, error
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV03

logger = logging.getLogger(__name__)

def create_walk_table(
    time_stamp_iso,
    speed,
    way_points: Path,
    file_name: str,
    route_name: str,
    creator_name: str,
    map_numbers: str,
):
    """

    Saves the Excel file as .output/Marschzeittabelle_{{file_name}}.xlsx'

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
    if len(way_points.way_points) >= 22:
        logger.error("Too many waypoints.")
        raise error.UserException("Zu viele Wegpunkte im Excel vorhanden.")

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

        sheet["A" + str(8 + i)] = (
            pt.name + " (" + str(int(lv95.lat)) + ", " + str(int(lv95.lon)) + ")"
        )
        sheet["C" + str(8 + i)] = int(lv95.h)
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

    xfile.save(file_name + "_Marschzeittabelle.xlsx")

    logger.info("Marschzeittabelle saved as " + file_name + "_Marschzeittabelle.xlsx")


def calc_walk_time(delta_height, delta_dist, speed):
    """

    Calculates the walking time form one point to another

    for this calculation the basic formula form Jugend+Sport is used for preciser we could use the formula
    form SchweizMobil or use more way points. But since we want to create a "normal" walk table as specified by
    Jugend+Sport we use there basic formula

    """

    if delta_height is None or delta_dist is None:
        return 0

    return (delta_dist + (delta_height / 100 if delta_height > 0 else 0)) / speed
