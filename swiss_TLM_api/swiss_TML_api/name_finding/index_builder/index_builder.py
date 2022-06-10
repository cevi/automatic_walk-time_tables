import fiona

from swiss_TML_api.name_finding.swiss_name import SwissName


class IndexBuilder:

    def __init__(self, index, reduced=False):
        self.index = index

        # The reduced dataset only contains the city of Bern
        base_path = './resources/swissTLM3D_LV95_data'
        self.base_path = base_path + ("_full/" if not reduced else "/")
        self.reduced = reduced

    def load(self):
        pass

    def add_pkt_file(self, shp_file, has_name=True):
        with fiona.open(shp_file) as src:
            for obj in src:
                geo = obj["geometry"]['coordinates']
                obj_type = obj['properties']['OBJEKTART']

                name = obj['properties']['NAME'] if has_name else obj_type

                swiss_name = SwissName(name=name, object_type=obj_type, x=int(geo[0]), y=int(geo[1]), h=int(geo[2]))
                self.index.insert(id=0, coordinates=(geo[0], geo[1]), obj=swiss_name)
