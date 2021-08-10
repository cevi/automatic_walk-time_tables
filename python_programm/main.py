import math
from datetime import timedelta, datetime
from io import BytesIO

import gpxpy.gpx
import matplotlib.pyplot as plt
import numpy as np
import openpyxl
import requests
from PIL import Image, ImageDraw

from calculations import calcTime
from find_name import find_name
from find_walk_table_points import find_points, prepare_for_plot
from transformation import GPSConverter


# creates a plot of the raw data points overlayed with the calculated way points
def create_plot(raw_data_points, way_points, file_name):
    # plot heights of exported data from SchweizMobil
    distances, heights = prepare_for_plot(raw_data_points)
    plt.plot(distances, heights, label='Wanderweg')

    # resize plot area
    additional_space = math.log(max(heights) - min(heights)) * 25
    plt.ylim(ymax=max(heights) + additional_space, ymin=min(heights) - additional_space)

    # add way_points to plot
    # plt.scatter([dist[0] for dist in temp_points], [height[1].elevation for height in temp_points], c='gray', )
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


# creates the walk table and print it on the console
def create_walk_table(time_stamp, speed):
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
    for i, point in enumerate(way_points_walk_table):

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

    # creates a map snippet of the point at the given coord (WGS84 format) and and mark it
    # saves the imag in the folder 'imgs/'


def create_map_snippet(coord, point_index):
    # convert Coordinates to LV03
    converter = GPSConverter()
    wgs84 = [coord.latitude, coord.longitude, coord.elevation]
    lv03 = converter.WGS84toLV03(wgs84[0], wgs84[1], wgs84[2])
    lv03 = np.round(lv03)

    # zoom level of the map snippets (a value form 0 to 12)
    zoom_level = 6

    # define constants
    tile_size = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64, 25.6]
    zoom_levels = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

    # calc the number of the centered tile
    x_tile = math.floor((lv03[0] - 420_000) / tile_size[zoom_level])
    y_tile = math.floor((350_000 - lv03[1]) / tile_size[zoom_level])

    # creates the urls of the image tiles as a 3x3 grid around the centered tile
    base_url = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/' + str(
        zoom_levels[zoom_level]) + '/'
    urls = [base_url + str(x_tile - 1) + '/' + str(y_tile - 1) + '.jpeg',
            base_url + str(x_tile - 1) + '/' + str(y_tile) + '.jpeg',
            base_url + str(x_tile - 1) + '/' + str(y_tile + 1) + '.jpeg',
            base_url + str(x_tile) + '/' + str(y_tile - 1) + '.jpeg',
            base_url + str(x_tile) + '/' + str(y_tile) + '.jpeg',
            base_url + str(x_tile) + '/' + str(y_tile + 1) + '.jpeg',
            base_url + str(x_tile + 1) + '/' + str(y_tile - 1) + '.jpeg',
            base_url + str(x_tile + 1) + '/' + str(y_tile) + '.jpeg',
            base_url + str(x_tile + 1) + '/' + str(y_tile + 1) + '.jpeg']

    # load tiles and combine map parts
    card_snippet_as_image = Image.new("RGB", (254 * 3, 254 * 3))
    for index, url in enumerate(urls):
        response = requests.get(url)
        img = Image.open(BytesIO(response.content))
        img.thumbnail((254, 254), Image.ANTIALIAS)
        x = index // 3 * 254
        y = index % 3 * 254
        w, h = img.size
        card_snippet_as_image.paste(img, (x, y, x + w, y + h))

    # calc the coords in respect to the image pixels
    img_x = 256.0 + ((lv03[0] - 420_000) % tile_size[zoom_level]) / (tile_size[zoom_level] / 254.0)
    img_y = 256.0 + ((350_000 - lv03[1]) % tile_size[zoom_level]) / (tile_size[zoom_level] / 254.0)
    circle_coords = (img_x - 18, img_y - 18, img_x + 18, img_y + 18)

    # mark point on the map
    draw = ImageDraw.Draw(card_snippet_as_image)
    draw.ellipse(circle_coords, outline=(255, 0, 0), width=5)

    # saves the image as '.jpg'
    card_snippet_as_image.save('imgs/' + str(point_index) + '_' + str(int(lv03[0])) + '_' + str(int(lv03[1])) + '.jpg')


def calc_perimeter(raw_gpx_data):
    min_latitude = None
    max_latitude = None
    min_longitude = None
    max_longitude = None

    for track in raw_gpx_data.tracks:
        for segment in track.segments:
            for point in segment.points:

                if min_latitude is None or point.latitude < min_latitude:
                    min_latitude = point.latitude

                if max_latitude is None or point.latitude > max_latitude:
                    max_latitude = point.latitude

                if min_longitude is None or point.longitude < min_longitude:
                    min_longitude = point.longitude

                if max_longitude is None or point.longitude > max_longitude:
                    max_longitude = point.longitude

        # convert Coordinates to LV03
        converter = GPSConverter()
        lv03_min = np.round(converter.WGS84toLV03(min_latitude, min_longitude, 400))
        lv03_max = np.round(converter.WGS84toLV03(max_latitude, max_longitude, 400))

    return lv03_min, lv03_max


def create_map_plot(gpx, way_points_walk_table):
    lv03_min, lv03_max = calc_perimeter(gpx)

    # define constants
    tile_sizes = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64, 25.6]
    zoom_levels = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

    # zoom level of the map snippets (a value form 0 to 12)
    zoom_level = 0

    x_count = 0
    y_count = 0

    while zoom_level < 12 and x_count * y_count < 64:
        zoom_level = zoom_level + 1

        # calc the number of the bottom left tile
        x_tile = math.floor((lv03_min[0] - 420_000) / tile_sizes[zoom_level]) - 1
        y_tile = math.floor((350_000 - lv03_min[1]) / tile_sizes[zoom_level]) + 1

        # calc number of tiles in each direction
        x_count = math.ceil((lv03_max[0] - lv03_min[0]) / tile_sizes[zoom_level]) + 2
        y_count = math.ceil((lv03_max[1] - lv03_min[1]) / tile_sizes[zoom_level]) + 2

    lv03_min = (x_tile * tile_sizes[zoom_level] + 420_000, 350_000 - y_tile * tile_sizes[zoom_level])
    print(zoom_level, ': ', x_count, ' ', y_count)

    # creates the urls of the image tiles as a 3x3 grid around the centered tile
    base_url = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/' + str(
        zoom_levels[zoom_level]) + '/'

    # load tiles and combine map parts
    card_snippet_as_image = Image.new("RGB", (254 * x_count, 254 * y_count))

    for i in range(0, x_count):
        for j in range(1, y_count + 1):
            url = base_url + str(x_tile + i) + '/' + str(y_tile - j) + '.jpeg'
            response = requests.get(url)
            img = Image.open(BytesIO(response.content))
            img.thumbnail((254, 254), Image.ANTIALIAS)

            w, h = img.size
            card_snippet_as_image.paste(img, (i * w, h * (y_count - j), i * w + w, h * (y_count - j) + h))

    converter = GPSConverter()

    # mark point on the map
    draw = ImageDraw.Draw(card_snippet_as_image)
    pixels_per_meter = (254.0 / tile_sizes[zoom_level])

    old_coords = None
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                wgs84 = [point.latitude, point.longitude, point.elevation]
                lv03 = np.round(converter.WGS84toLV03(wgs84[0], wgs84[1], wgs84[2]))

                # calc the coords in respect to the image pixels
                img_x = (lv03[0] - lv03_min[0]) * pixels_per_meter
                img_y = card_snippet_as_image.size[1] - (lv03[1] - lv03_min[1]) * pixels_per_meter

                if old_coords is not None:
                    draw.line((old_coords, (img_x, img_y)), fill=(255, 0, 0), width=5)

                old_coords = (img_x, img_y)

    for point in way_points_walk_table:
        wgs84 = [point[1].latitude, point[1].longitude, point[1].elevation]
        lv03 = np.round(converter.WGS84toLV03(wgs84[0], wgs84[1], wgs84[2]))

        # calc the coords in respect to the image pixels
        img_x = (lv03[0] - lv03_min[0]) * pixels_per_meter
        img_y = card_snippet_as_image.size[1] - (lv03[1] - lv03_min[1]) * pixels_per_meter

        circle_coords = (img_x - 18, img_y - 18, img_x + 18, img_y + 18)

        draw.ellipse(circle_coords, outline=(128, 255, 255), width=5)

    # saves the image as '.jpg'
    card_snippet_as_image.save('imgs/test.jpg')
    card_snippet_as_image.show()


########################################################################################################################
########################################################################################################################
########################################################################################################################


# Open GPX-File with the way-points
gpx_file = open('./testWalks/hikesola2021esperia.gpx', 'r')
gpx = gpxpy.parse(gpx_file)

# define the departure time of the hike
start_time = datetime(year=2021, month=8, day=16, hour=10, minute=00)

# get Meta-Data
name = gpx.tracks[0].name

# calc Points for walk table
total_distance, temp_points, way_points_walk_table = find_points(gpx)
create_plot(gpx, way_points_walk_table, file_name=name + '.png')

# prints the walk table and the associated timestamps / meta infos
# create_walk_table(start_time, 3.75)

create_map_plot(gpx, way_points_walk_table)
