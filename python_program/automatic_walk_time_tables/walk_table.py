import math
import os
from datetime import timedelta
from typing import Tuple, List

import gpxpy
import numpy as np
import openpyxl
from gpxpy.gpx import GPXTrackPoint
from matplotlib import pyplot as plt

from . import coord_transformation
from . import find_swisstopo_name
from . import find_walk_table_points


def plot_elevation_profile(raw_data_points: gpxpy.gpx,
                           way_points: List[Tuple[int, GPXTrackPoint]],
                           temp_points: List[Tuple[int, GPXTrackPoint]],
                           file_name: str,
                           open_figure: bool):
    """

    Plots the elevation profile of the path contained in the GPX-file. In addition the
    plot contains the approximated elevation profile by the way_points.

    Saves the plot as an image in the ./output directory as an image called {{file_name}}<.png

    """

    # plot heights of exported data from SchweizMobil
    distances, heights = find_walk_table_points.prepare_for_plot(raw_data_points)
    plt.plot(distances, heights, label='Wanderweg')

    # resize plot area
    additional_space = math.log(max(heights) - min(heights)) * 25
    plt.ylim(ymax=max(heights) + additional_space, ymin=min(heights) - additional_space)

    # add way_points to plot
    plt.scatter([dist[0] for dist in temp_points], [height[1].elevation for height in temp_points], c='lightgray', )
    plt.scatter([dist[0] for dist in way_points], [height[1].elevation for height in way_points], c='orange', )
    plt.plot([dist[0] for dist in way_points], [height[1].elevation for height in way_points],
             label='Marschzeittabelle')

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
    plt.savefig('output/' + file_name + '_elevation_profile.png', dpi=750)

    if open_figure:
        plt.show()


def create_walk_table(time_stamp, speed, way_points, total_distance, file_name: str, creator_name: str, map_numbers: str):
    """

    Saves the Excel file as .output/Marschzeittabelle_{{file_name}}.xlsx'

    """

    xfile = openpyxl.load_workbook('res/Marschzeit_Template.xlsx')
    sheet = xfile.worksheets[0]
    oldPoint = None
    time = 0

    print('                                          Geschwindigkeit: ', speed, 'km/h')
    print()
    print('Distanz Höhe           Zeit   Uhrzeit     Ort (Koordinaten und Namen)')
    
    sheet['A6'] = map_numbers
    sheet['B2'] = file_name
    sheet['B3'] = time_stamp.strftime('%d.%m.%Y')
    sheet['B4'] = creator_name
    sheet['N3'] = speed
    sheet['K8'] = time_stamp.strftime('%H:%M')

    name_of_points = []

    # get Infos points
    for i, point in enumerate(way_points):

        # convert Coordinates to LV03
        converter = coord_transformation.GPSConverter()
        wgs84 = [point[1].latitude, point[1].longitude, point[1].elevation]
        lv03 = converter.WGS84toLV03(wgs84[0], wgs84[1], wgs84[2])
        lv03 = np.round(lv03)

        # calc time
        deltaTime = 0.0
        if oldPoint is not None:
            deltaTime = calcTime(point[1].elevation - oldPoint[1].elevation, abs(oldPoint[0] - point[0]), speed)
        time += deltaTime

        time_stamp = time_stamp + timedelta(hours=deltaTime)

        # print infos
        name_of_point = find_swisstopo_name.find_name((lv03[0] + 2_000_000, lv03[1] + 1_000_000))
        name_of_points.append(name_of_point)
        print(
            round(abs((oldPoint[0] if oldPoint is not None else 0.0) - point[0]), 1), 'km ',
            int(lv03[2]), 'm ü. M.  ',
            round(deltaTime, 1), 'h ',
            time_stamp.strftime('%H:%M'), 'Uhr  ',
            (int(lv03[0]), int(lv03[1])), name_of_point)

        sheet['A' + str(8 + i)] = str(name_of_point) + ' (' + str(
            int(lv03[0])) + ', ' + str(int(lv03[1])) + ')'
        sheet['C' + str(8 + i)] = int(lv03[2])
        if i > 0:
            sheet['E' + str(8 + i)] = round(abs((oldPoint[0] if oldPoint is not None else 0.0) - point[0]), 1)

        oldPoint = point

    print('--- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---')
    print(round(total_distance, 1), 'km', '', round(time, 1), 'h')
    print('=== === === === === === === === === === === === === === === === === === ===')
    print()
    print()

    # Check if output directory exists, if not, create it.
    if (not os.path.exists('output')):
        os.mkdir('output')

    xfile.save('output/' + file_name + '_Marschzeittabelle.xlsx')
    return name_of_points


def calcTime(delta_height, delta_dist, speed):
    """

    Calculates the walking time form one point to another

    for this calculation the basic formula form Jugend+Sport is used for preciser we could use the formula
    form SchweizMobil or use more way points. But since we want to create a "normal" walk table as specified by
    Jugend+Sport we use there basic formula

    """

    if delta_height is None or delta_dist is None:
        return 0

    return (delta_dist + (delta_height / 100 if delta_height > 0 else 0)) / speed
