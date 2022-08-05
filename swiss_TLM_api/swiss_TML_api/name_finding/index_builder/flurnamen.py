import fiona
from shapely.geometry import Polygon

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Flurnamen(IndexBuilder):
    """
    This IndexBuilder inserts all intersections where the name of at least two adjacent streets is known.
    """

    def load(self):
        shp_file = self.base_path + 'swissTLM3D_TLM_FLURNAME.shp'
        self.add_pkt_file(shp_file)

        shp_file = self.base_path + 'swissTLM3D_TLM_SIEDLUNGSNAME.shp'
        with fiona.open(shp_file) as src:
            for obj in src:
                geo = obj["geometry"]['coordinates'][0]

                geo = list(map(lambda p: p[:-1], geo))  # remove elevation information
                polygon = Polygon(geo)

                # We only want to store small Willers not entire cities.
                if polygon.area < 30_000:
                    coord = polygon.centroid
                    obj_type = obj['properties']['OBJEKTART']
                    name = obj['properties']['NAME']
                    height = sum([pkt[2] for pkt in obj["geometry"]['coordinates'][0]]) / len(geo)  # get mean height
                    swiss_name = SwissName(name=name, object_type=obj_type, x=int(coord.x), y=int(coord.y), h=height)
                    self.index.insert(id=0, coordinates=(coord.x, coord.y), obj=swiss_name)
