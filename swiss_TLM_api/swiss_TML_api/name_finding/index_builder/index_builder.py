class IndexBuilder:

    def __init__(self, index, reduced=False):
        self.index = index

        # The reduced dataset only contains the city of Bern
        base_path = './resources/swissTLM3D_1.9_LV95_LN02_shp3d'
        self.base_path = base_path + ("_full/" if not reduced else "/")
        self.reduced = reduced

    def load(self):
        pass
