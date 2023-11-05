from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder


class Einzelobjekte(IndexBuilder):
    """
    This IndexBuilder inserts all intersections where the name of at least two adjacent streets is known.
    """

    def load(self):
        shp_file = self.base_path + "swissTLM3D_TLM_EINZELOBJEKT.shp"

        # TODO: add Reservoir as info to Wasserversorgung (e.g.	2601703, 1195452)
        self.add_pkt_file(shp_file, has_name=False)
