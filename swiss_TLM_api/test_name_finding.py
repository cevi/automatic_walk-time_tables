import json
import logging
import random

from PIL import ImageDraw
from PIL import ImageFont
from shapely.geometry import LineString

from swiss_TML_api.logging.log_helper import setup_recursive_logger
from swiss_TML_api.name_finding.interest import Interest
from test_helper.print_map_snipped import MapImage

setup_recursive_logger(logging.INFO)
logger = logging.getLogger(__name__)

from swiss_TML_api.name_finding.name_finder import NameFinder


def get_random_coordinates_along_path():
    # TODO: use the route for producing random coordinate points.

    with open("longpath.json", "r") as f:
        lv03_path = json.load(f)
        length = len(lv03_path)
        pkt = lv03_path[random.randint(0, length - 1)]
        return pkt

if __name__ == "__main__":

    lv03_coord = [2651537.71, 1114910.83]  # get_random_coordinates_along_path()
    bounds = [[lv03_coord[0] - 1000, lv03_coord[1] - 1000], [lv03_coord[0] + 1000, lv03_coord[1] + 1000]]
    name_index = NameFinder(force_rebuild=False, reduced=False)

    image = MapImage(lv03_coord, zoom_level=9)

    draw = ImageDraw.Draw(image.img)
    fnt = ImageFont.load_default()
    # Set up the root handler
    names = name_index.get_names(lv03_coord[0], lv03_coord[1], 75) # for marking only
    interest = Interest(name_index)
    res = interest.select_name(lv03_coord)
    print("bestRes", res)
    for name in names:
        #print(name)
        image.mark_point(draw, (name.x, name.y), 4)

    draw.rectangle((0, 0, image.img.size[0], 24), fill=(255, 255, 255))
    draw.text((0.0, 0.0), str(names[0]), (0, 0, 0), font=fnt)

    image.img.save("map_snipped.png")
