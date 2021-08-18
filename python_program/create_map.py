import math
from io import BytesIO

import gpxpy
import grequests
import numpy as np
from PIL import Image, ImageDraw

from python_program.coord_transformation import GPSConverter
from python_program.gpx_utils import calc_perimeter

TILE_SIZES = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64, 25.6]
""" Tile width m, see https://api3.geo.admin.ch/services/sdiservices.html#wmts """

ZOOM_LEVELS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]
""" Zoom levels, see https://api3.geo.admin.ch/services/sdiservices.html#wmts """

TILE_WIDTH = 256
""" Width of a tile in pixels """

TILE_MATRIX_SET: str = '2056'
""" EPSG code for LV03/CH1903 """


def plot_route_on_map(raw_gpx_data: gpxpy.gpx,
                      way_points: [],
                      file_name: str,
                      layer: str = 'ch.swisstopo.pixelkarte-farbe',
                      tile_format_ext: str = 'jpeg'):
    """

    Creates a map of the route and marking the selected way points on it.

    raw_gpx_data : raw data form imported GPX file
    way_points : selected way points of the  walk-time table
    tile_format_ext : Format of the tile, allowed values jpeg or png, default jpeg
    layer : Map layer, see https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml for options

    """

    lv03_min, lv03_max = calc_perimeter(raw_gpx_data)

    # zoom level of the map snippets (a value form 0 to 12)
    zoom_level = 0

    x_count = 0
    y_count = 0

    while zoom_level < 12 and x_count * y_count < 36:
        zoom_level = zoom_level + 1

        # calc the number of the bottom left tile
        tile_base_row = math.floor((lv03_min[0] - 420_000) / TILE_SIZES[zoom_level]) - 1
        tile_base_col = math.floor((350_000 - lv03_min[1]) / TILE_SIZES[zoom_level]) + 1

        # calc number of tiles in each direction
        x_count = math.ceil((lv03_max[0] - lv03_min[0]) / TILE_SIZES[zoom_level]) + 2
        y_count = math.ceil((lv03_max[1] - lv03_min[1]) / TILE_SIZES[zoom_level]) + 2

    lv03_min = (tile_base_row * TILE_SIZES[zoom_level] + 420_000, 350_000 - tile_base_col * TILE_SIZES[zoom_level])

    # load tiles and combine map parts
    card_snippet_as_image = Image.new("RGBA", (TILE_WIDTH * x_count, TILE_WIDTH * y_count))

    base_url = 'http://wmts.geo.admin.ch/1.0.0/' + layer + \
               '/default/current/' + TILE_MATRIX_SET + '/' + str(ZOOM_LEVELS[zoom_level]) + '/'

    # create urls
    urls = []
    for i in range(0, x_count):
        for j in range(1, y_count + 1):
            urls.append(base_url + str(tile_base_row + i) + '/' + str(tile_base_col - j) + '.' + tile_format_ext)

    print('URL of a sample tile: ' + urls[0])

    # Since swisstopo services are free, we must guarantee to use the service fairly
    # See https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html
    if len(urls) > 300:
        raise Exception('Fair use limit exceeded!')

    # Request images in parallel
    rs = (grequests.get(u) for u in urls)
    results = grequests.map(rs)

    index = 0
    for i in range(0, x_count):
        for j in range(1, y_count + 1):
            response = results[index]
            index = index + 1
            img = Image.open(BytesIO(response.content))
            img.thumbnail((TILE_WIDTH, TILE_WIDTH), Image.ANTIALIAS)

            w, h = img.size
            card_snippet_as_image.paste(img, (i * w, h * (y_count - j), i * w + w, h * (y_count - j) + h))

    # mark point on the map
    draw = ImageDraw.Draw(card_snippet_as_image)
    pixels_per_meter = (TILE_WIDTH / TILE_SIZES[zoom_level])

    old_coords = None
    for track in raw_gpx_data.tracks:
        for segment in track.segments:
            for point in segment.points:
                wgs84_point = [point.latitude, point.longitude, point.elevation]
                img_x, img_y = calc_img_coord(card_snippet_as_image.size, lv03_min, pixels_per_meter, wgs84_point)

                if old_coords is not None:
                    draw.line((old_coords, (img_x, img_y)), fill=(255, 165, 0), width=5)

                old_coords = (img_x, img_y)

    for point in way_points:
        wgs84_point = [point[1].latitude, point[1].longitude, point[1].elevation]
        img_x, img_y = calc_img_coord(card_snippet_as_image.size, lv03_min, pixels_per_meter, wgs84_point)

        pkt_rad = 10
        circle_coords = (img_x - pkt_rad, img_y - pkt_rad, img_x + pkt_rad, img_y + pkt_rad)

        draw.ellipse(circle_coords, outline=(255, 0, 0), width=5)

    # saves the image as '.jpg'
    card_snippet_as_image.save('output/' + file_name + '_map.png')
    card_snippet_as_image.show()


def calc_img_coord(image_size, lv03_min, pixels_per_meter, wgs84_point):
    converter = GPSConverter()

    lv03_point = np.round(converter.WGS84toLV03(wgs84_point[0], wgs84_point[1], wgs84_point[2]))
    # calc the coords in respect to the image pixels
    img_x = (lv03_point[0] - lv03_min[0]) * pixels_per_meter
    img_y = image_size[1] - (lv03_point[1] - lv03_min[1]) * pixels_per_meter

    return img_x, img_y
