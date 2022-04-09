import fiona

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class StopsAndStations(IndexBuilder):
    """
    This IndexBuilder inserts all intersections where the name of at least two adjacent streets is known.
    """

    def load(self):
        shp_file = self.base_path + 'swissTLM3D_TLM_HALTESTELLE.shp'

        with fiona.open(shp_file) as src:
            for obj in src:
                geo = obj["geometry"]['coordinates']
                obj_type = obj['properties']['OBJEKTART']
                name = obj['properties']['NAME']
                swiss_name = SwissName(name=name, object_type=obj_type, x=int(geo[0]), y=int(geo[1]), h=geo[2])
                self.index.insert(id=0, coordinates=geo[0:2], obj=swiss_name)
