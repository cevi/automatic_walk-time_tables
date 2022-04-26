import logging
import os
from datetime import timedelta
from math import log
from typing import List

import openpyxl
from matplotlib import pyplot as plt

from automatic_walk_time_tables.geo_processing import find_swisstopo_name, find_walk_table_points
from automatic_walk_time_tables.utils import path
from automatic_walk_time_tables.utils.point import Point_LV03, Point_LV95
from automatic_walk_time_tables.utils.way_point import WayPoint

logger = logging.getLogger(__name__)


def plot_elevation_profile(path_: path.Path_LV03,
                           way_points: List[WayPoint],
                           temp_points: List[WayPoint],
                           file_name: str,
                           open_figure: bool):
    """

    Plots the elevation profile of the path contained in the GPX-file. In addition the
    plot contains the approximated elevation profile by the way_points.

    Saves the plot as an image in the ./output directory as an image called {{file_name}}<.png

    """

    # clear the plot, plot heights of exported data from SchweizMobil
    plt.clf()
    distances, heights = find_walk_table_points.prepare_for_plot(path_)
    plt.plot([d / 1_000.0 for d in distances], heights, label='Wanderweg')

    # resize plot area
    additional_space = log(max(heights) - min(heights)) * 25
    plt.ylim(ymax=max(heights) + additional_space, ymin=min(heights) - additional_space)

    # add way_points to plot
    plt.scatter([p.accumulated_distance / 1_000.0 for p in temp_points], [p.point.h for p in temp_points],
                c='lightgray')
    plt.scatter([p.accumulated_distance / 1_000.0 for p in way_points], [p.point.h for p in way_points],
                c='orange')
    plt.plot([p.accumulated_distance / 1_000.0 for p in way_points], [p.point.h for p in way_points],
             label='Marschzeittabelle')

    # Check difference between the length of the original path and the length of the way points
    logger.info("way_points = {} | distances = {}".format(way_points[-1].accumulated_distance, distances[-1]))
    assert abs(way_points[-1].accumulated_distance - distances[-1]) <= 250  # max diff 250 meters

    # labels
    plt.ylabel('Höhe [m ü. M.]')
    plt.xlabel('Distanz [km]')
    plt.title('Höhenprofil', fontsize=20)
    plt.legend(loc='upper right', frameon=False)

    # Grid
    plt.grid(color='gray', linestyle='dashed', linewidth=0.5)

    # Check if output directory exists, if not, create it.
    if (not os.path.exists('output')):
        os.mkdir('output')

    # show the plot and save image
    plt.savefig(file_name + '_elevation_profile.png', dpi=750)

    logger.info("Elevation profile plot saved as " + file_name + '_elevation_profile.png')

    if open_figure:
        logger.debug("Opening figure as specified by the user.")
        plt.show()


def create_walk_table(time_stamp, speed, way_points: List[WayPoint], total_distance, file_name: str,
                      route_name: str, creator_name: str,
                      map_numbers: str):
    """

    Saves the Excel file as .output/Marschzeittabelle_{{file_name}}.xlsx'

    """
    # print the current path to debug
    try:
        xfile = openpyxl.load_workbook('automatic_walk_time_tables/res/Marschzeit_Template.xlsx')
    except:
        try:
            xfile = openpyxl.load_workbook('res/Marschzeit_Template.xlsx')
        except:
            logger.error("Could not find template file for walk table.")
            raise FileNotFoundError

    sheet = xfile.worksheets[0]
    oldPoint = None
    time = 0

    logger.debug('                                          Geschwindigkeit: ' + str(speed) + 'km/h\n')
    logger.debug('Distanz Höhe           Zeit   Uhrzeit     Ort (Koordinaten und Namen)')

    sheet['A6'] = map_numbers
    sheet['B2'] = route_name
    sheet['B3'] = time_stamp.strftime('%d.%m.%Y')
    sheet['B4'] = creator_name
    sheet['N3'] = speed
    sheet['K8'] = time_stamp.strftime('%H:%M')

    name_of_points = []

    # get infos about points
    for i, pt in enumerate(way_points):
        lv03: Point_LV03 = pt.point.to_LV03()

        # calc time
        deltaTime = 0.0
        if oldPoint is not None:
            deltaTime = calc_walk_time(pt.point.h - oldPoint.point.h,
                                       abs(oldPoint.accumulated_distance - pt.accumulated_distance), speed)
        time += deltaTime

        time_stamp = time_stamp + timedelta(hours=deltaTime)

        # print infos (in LV95)
        name_of_point = find_swisstopo_name.find_name(lv03.to_LV95(), 50)
        name_of_points.append(name_of_point)
        logger.debug(
            str(round(abs((oldPoint.accumulated_distance if oldPoint is not None else 0.0) - pt.accumulated_distance),
                      1)) + 'km ' +
            str(int(lv03.h)) + 'm ü. M. ' +
            str(round(deltaTime, 1)) + 'h ' +
            time_stamp.strftime('%H:%M') + 'Uhr ' +
            str((int(lv03.lat), int(lv03.lon))) + " " + name_of_point)

        sheet['A' + str(8 + i)] = str(name_of_point) + ' (' + str(
            int(lv03.lat)) + ', ' + str(int(lv03.lon)) + ')'
        sheet['C' + str(8 + i)] = int(lv03.h)
        if i > 0:
            sheet['E' + str(8 + i)] = round(
                abs((oldPoint.accumulated_distance if oldPoint is not None else 0.0) - pt.accumulated_distance), 1)

        oldPoint = pt

    logger.debug('--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---')
    logger.debug(str(round(total_distance, 1)) + 'km ' + str(round(time, 1)) + 'h')
    logger.debug('=== === === === === === === === === === === === === === === === === === ===')

    # Check if output directory exists, if not, create it.
    if (not os.path.exists('output')):
        os.mkdir('output')

    xfile.save(file_name + '_Marschzeittabelle.xlsx')

    logger.info("Marschzeittabelle saved as " + file_name + '_Marschzeittabelle.xlsx')

    return name_of_points


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
