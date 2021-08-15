import math
from datetime import timedelta

import numpy as np
import openpyxl
from matplotlib import pyplot as plt

from python_program.calculations import calcTime
from python_program.find_name import find_name
from python_program.find_walk_table_points import prepare_for_plot
from python_program.transformation import GPSConverter


def plot_elevation_profile(raw_data_points, way_points, temp_points, file_name):
    # plot heights of exported data from SchweizMobil
    distances, heights = prepare_for_plot(raw_data_points)
    plt.plot(distances, heights, label='Wanderweg')

    # resize plot area
    additional_space = math.log(max(heights) - min(heights)) * 25
    plt.ylim(ymax=max(heights) + additional_space, ymin=min(heights) - additional_space)

    # add way_points to plot
    plt.scatter([dist[0] for dist in temp_points], [height[1].elevation for height in temp_points], c='gray', )
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

    # show the plot and save image
    plt.savefig('imgs/' + file_name, dpi=750)
    plt.show()


def create_walk_table(time_stamp, speed, way_points, total_distance):
    xfile = openpyxl.load_workbook('res/Marschzeit_Template.xlsx')
    sheet = xfile.worksheets[0]
    oldPoint = None
    time = 0

    print('                                                     Geschwindikeit: ', speed, 'km/h')
    print()
    print('Distanz Höhe           Zeit   Uhrzeit     Ort (Koordinaten und Namen)')

    sheet['N3'] = speed
    sheet['K8'] = time_stamp.strftime('%H:%M')

    # get Infos points
    for i, point in enumerate(way_points):

        # convert Coordinates to LV03
        converter = GPSConverter()
        wgs84 = [point[1].latitude, point[1].longitude, point[1].elevation]
        lv03 = converter.WGS84toLV03(wgs84[0], wgs84[1], wgs84[2])
        lv03 = np.round(lv03)

        # calc time
        deltaTime = 0.0
        if oldPoint is not None:
            deltaTime = calcTime(point[1].elevation - oldPoint[1].elevation, abs(oldPoint[0] - point[0]), speed)
        time += deltaTime

        time_stamp = time_stamp + timedelta(hours=deltaTime)

        # print in§fos
        print(
            round(abs((oldPoint[0] if oldPoint is not None else 0.0) - point[0]), 1), 'km ',
            int(lv03[2]), 'm ü. M.  ',
            round(deltaTime, 1), 'h ',
            time_stamp.strftime('%H:%M'), 'Uhr  ',
            (int(lv03[0]), int(lv03[1])), find_name((lv03[0] + 2_000_000, lv03[1] + 1_000_000), 75))

        sheet['A' + str(8 + i)] = str(find_name((lv03[0] + 2_000_000, lv03[1] + 1_000_000), 75)) + ' (' + str(
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

    xfile.save('Marschzeittabelle_Generiert.xlsx')
