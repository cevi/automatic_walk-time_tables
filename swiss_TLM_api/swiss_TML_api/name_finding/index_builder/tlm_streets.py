import fiona

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class TLM_Streets(IndexBuilder):

    def load(self):
        base_path = './resources/swissTLM3D_1.9_LV95_LN02_shp3d_full/'
        shp_file = base_path + 'swissTLM3D_TLM_STRASSE.shp'

        with fiona.open(shp_file) as src:

            for obj in src:

                geo = obj["geometry"]['coordinates']
                obj_type = obj['properties']['OBJEKTART']

                if obj_type == 'Platz' and obj["geometry"]['type'] == 'LineString':
                    pkt = geo[0][:-1]

                    name = "{} {} {}".format(obj['properties']['KUNSTBAUTE'], obj['properties']['WANDERWEGE'],
                                             obj['properties']['STR_NAME_U'])

                    swiss_name = SwissName(name=name, object_type='Platz', x=int(pkt[0]), y=int(pkt[0]), h=0)
                    self.index.insert(id=0, coordinates=pkt, obj=swiss_name)
