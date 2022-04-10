import fiona

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Versorgungsbauten(IndexBuilder):
    """
    This IndexBuilder inserts all intersections where the name of at least two adjacent streets is known.
    """

    def load(self):
        shp_file = self.base_path + 'swissTLM3D_TLM_VERSORGUNGS_BAUTE_PKT.shp'
        self.add_pkt_file(shp_file, has_name=False)