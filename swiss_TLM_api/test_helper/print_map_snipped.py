import math
from io import BytesIO

import grequests
from PIL import Image, ImageDraw


class MapImage:
    TILE_SIZES = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64, 25.6]
    ZOOM_LEVELS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]
    TILE_WIDTH = 256
    TILE_MATRIX_SET: str = '2056'
    layer: str = 'ch.swisstopo.pixelkarte-farbe'
    tile_format_ext: str = 'jpeg'
    x_count = 3
    y_count = 3

    def __init__(self, lv03_pkt, zoom_level):

        self.img = Image.new("RGBA", (self.TILE_WIDTH * self.x_count, self.TILE_WIDTH * self.y_count))

        # calc the number of the bottom left tile
        tile_base_row = math.floor((lv03_pkt[0] - 2420_000) / self.TILE_SIZES[zoom_level]) - 1
        tile_base_col = math.floor((1350_000 - lv03_pkt[1]) / self.TILE_SIZES[zoom_level]) + 2
        base_url = 'https://wmts.geo.admin.ch/1.0.0/' + self.layer + \
                   '/default/current/' + self.TILE_MATRIX_SET + '/' + str(self.ZOOM_LEVELS[zoom_level]) + '/'

        # create urls
        urls = []
        for i in range(0, self.x_count):
            for j in range(1, self.y_count + 1):
                urls.append(
                    base_url + str(tile_base_row + i) + '/' + str(tile_base_col - j) + '.' + self.tile_format_ext)

        # Since swisstopo services are free, we must guarantee to use the service fairly
        # See https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html
        if len(urls) > 300:
            raise Exception('Fair use limit exceeded!')

        # Request images in parallel
        rs = (grequests.get(u) for u in urls)
        results = grequests.map(rs)

        index = 0
        for i in range(0, self.x_count):
            for j in range(1, self.y_count + 1):
                response = results[index]
                index = index + 1
                img = Image.open(BytesIO(response.content))
                img.thumbnail((self.TILE_WIDTH, self.TILE_WIDTH), Image.ANTIALIAS)

                w, h = img.size
                self.img.paste(img, (i * w, h * (self.y_count - j), i * w + w, h * (self.y_count - j) + h))

        # mark point on the map
        draw = ImageDraw.Draw(self.img)

        self.lv03_min = (tile_base_row * self.TILE_SIZES[zoom_level] + 2420_000,
                         1350_000 - tile_base_col * self.TILE_SIZES[zoom_level])
        self.pixels_per_meter = (self.TILE_WIDTH / self.TILE_SIZES[zoom_level])

        self.mark_point(draw, lv03_pkt, 11)

    def mark_point(self, draw, lv03_pkt, pkt_rad):
        img_x, img_y = self.calc_img_coord(self.img.size, lv03_pkt)
        circle_coords = (img_x - pkt_rad, img_y - pkt_rad, img_x + pkt_rad, img_y + pkt_rad)
        draw.ellipse(circle_coords, outline=(255, 0, 0), width=5)

    def calc_img_coord(self, image_size, lv03_point):
        # calc the coords in respect to the image pixels
        img_x = (lv03_point[0] - self.lv03_min[0]) * self.pixels_per_meter
        img_y = image_size[1] - (lv03_point[1] - self.lv03_min[1]) * self.pixels_per_meter

        return img_x, img_y
