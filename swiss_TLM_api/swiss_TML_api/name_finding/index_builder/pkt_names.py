from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder


class PKTNames(IndexBuilder):
    """
    This IndexBuilder inserts all point names (e.g. mountain peaks).
    """

    def load(self):
        shp_file = self.base_path + 'swissTLM3D_TLM_NAME_PKT.shp'

        self.add_pkt_file(shp_file, has_name=True)
