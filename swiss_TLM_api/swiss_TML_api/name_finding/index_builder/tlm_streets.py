import fiona

from swiss_TML_api.name_finding.helper_index.street_index import StreetIndex
from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class TLM_Streets(IndexBuilder):
    """
    This IndexBuilder inserts all intersections where the name of at least two adjacent streets is known.
    """

    def load(self):

        street_index_builder = StreetIndex(self.base_path + 'swissTLM3D_TLM_STRASSE.shp')
        path_index = street_index_builder.get_street_index()

        shp_file = self.base_path + 'swissTLM3D_TLM_STRASSENINFO.shp'

        with fiona.open(shp_file) as src:

            for obj in src:

                geo = obj["geometry"]['coordinates']
                obj_type = obj['properties']['OBJEKTART']

                if obj_type == 'Standardknoten':
                    search_area = (geo[0] - 1, geo[1] - 1, geo[0] + 1, geo[1] + 1)
                    adjoined_streets = path_index.intersection(coordinates=search_area, objects='raw')

                    street_names = set(
                        [obj['properties']['STRNAME'] for obj in adjoined_streets if obj['properties']['STRNAME']])

                    if len(street_names) >= 2:
                        name = "Kreuzung: {}".format(', '.join(str(s) for s in street_names))
                        swiss_name = SwissName(name=name, object_type='Kreuzung', x=int(geo[0]), y=int(geo[1]),
                                               h=geo[2])
                        self.index.insert(id=0, coordinates=geo[0:2], obj=swiss_name)
