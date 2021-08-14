import math
from io import BytesIO

import numpy as np
import requests
from PIL import Image, ImageDraw

from python_programm.gpx_utils import calc_perimeter
from python_programm.transformation import GPSConverter

TILE_SIZES = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64, 25.6]
ZOOM_LEVELS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]


def plot_route_on_map(raw_gpx_data, way_points):
    lv03_min, lv03_max = calc_perimeter(raw_gpx_data)

    # zoom level of the map snippets (a value form 0 to 12)
    zoom_level = 0

    x_count = 0
    y_count = 0

    while zoom_level < 12 and x_count * y_count < 64:
        zoom_level = zoom_level + 1

        # calc the number of the bottom left tile
        x_tile = math.floor((lv03_min[0] - 420_000) / TILE_SIZES[zoom_level]) - 1
        y_tile = math.floor((350_000 - lv03_min[1]) / TILE_SIZES[zoom_level]) + 1

        # calc number of tiles in each direction
        x_count = math.ceil((lv03_max[0] - lv03_min[0]) / TILE_SIZES[zoom_level]) + 2
        y_count = math.ceil((lv03_max[1] - lv03_min[1]) / TILE_SIZES[zoom_level]) + 2

    lv03_min = (x_tile * TILE_SIZES[zoom_level] + 420_000, 350_000 - y_tile * TILE_SIZES[zoom_level])
    print(zoom_level, ': ', x_count, ' ', y_count)

    # creates the urls of the image tiles as a 3x3 grid around the centered tile
    base_url = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/' + str(
        ZOOM_LEVELS[zoom_level]) + '/'

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

    # mark point on the map
    draw = ImageDraw.Draw(card_snippet_as_image)
    pixels_per_meter = (254.0 / TILE_SIZES[zoom_level])

    old_coords = None
    for track in raw_gpx_data.tracks:
        for segment in track.segments:
            for point in segment.points:
                wgs84_point = [point.latitude, point.longitude, point.elevation]
                img_x, img_y = calc_img_cood(card_snippet_as_image.size, lv03_min, pixels_per_meter, wgs84_point)

                if old_coords is not None:
                    draw.line((old_coords, (img_x, img_y)), fill=(255, 165, 0), width=5)

                old_coords = (img_x, img_y)

    for point in way_points:
        wgs84_point = [point[1].latitude, point[1].longitude, point[1].elevation]
        img_x, img_y = calc_img_cood(card_snippet_as_image.size, lv03_min, pixels_per_meter, wgs84_point)

        circle_coords = (img_x - 18, img_y - 18, img_x + 18, img_y + 18)

        draw.ellipse(circle_coords, outline=(255, 0, 0), width=5)

    # saves the image as '.jpg'
    card_snippet_as_image.save('imgs/map.jpg')
    card_snippet_as_image.show()


def calc_img_cood(image_size, lv03_min, pixels_per_meter, wgs84_point):
    converter = GPSConverter()

    lv03_point = np.round(converter.WGS84toLV03(wgs84_point[0], wgs84_point[1], wgs84_point[2]))
    # calc the coords in respect to the image pixels
    img_x = (lv03_point[0] - lv03_min[0]) * pixels_per_meter
    img_y = image_size[1] - (lv03_point[1] - lv03_min[1]) * pixels_per_meter

    return img_x, img_y
