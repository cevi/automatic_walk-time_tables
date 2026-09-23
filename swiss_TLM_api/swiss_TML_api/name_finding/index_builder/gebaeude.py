import fiona
from shapely.geometry import shape

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Gebaeude(IndexBuilder):
    """
    Inserts Towers, Chapels, Historic Buildings into the index.
    """

    def load(self):
        shp_files = [
            self.base_path + "swissTLM3D_TLM_GEBAEUDE_FOOTPRINT_OST.shp",
            self.base_path + "swissTLM3D_TLM_GEBAEUDE_FOOTPRINT_WEST.shp",
        ]

        for shp_file in shp_files:
            try:
                with fiona.open(shp_file) as src:
                    for obj in src:
                        obj_type = obj["properties"].get("OBJEKTART", "")
                        nutzung = obj["properties"].get("NUTZUNG", "")

                        # Default gebaeude whitelist
                        is_valid = obj_type in ["Turm", "Kapelle", "Historische Baute"]

                        # Check for SAC or Hütte or Gasthof
                        n_lower = ("" if nutzung is None else nutzung).lower()
                        o_lower = ("" if obj_type is None else obj_type).lower()

                        if (
                            "sac" in n_lower
                            or "hütte" in n_lower
                            or "abgelegener gasthof" in n_lower
                            or "abgelegener gasthof" in o_lower
                        ):
                            is_valid = True

                        if not is_valid:
                            continue

                        geo = shape(obj["geometry"])
                        name = obj["properties"].get("NAME", "")
                        if name is None:
                            name = ""

                        if not name:
                            if nutzung and nutzung != "unbekannt":
                                name = nutzung
                            else:
                                name = obj_type

                        centroid = geo.centroid
                        x, y = centroid.x, centroid.y
                        h = 0

                        swiss_name = SwissName(
                            name=name,
                            object_type=obj_type,
                            x=int(x),
                            y=int(y),
                            h=int(h),
                        )
                        self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)
            except Exception as e:
                print(f"Skipping {shp_file} due to: {e}")
