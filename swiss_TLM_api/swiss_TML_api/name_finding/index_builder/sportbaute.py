import fiona
from shapely.geometry import shape

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Sportbaute(IndexBuilder):
    """
    Inserts Sportbaute (Rodelbahn, Skisprungschanze, Sportplatz).
    """

    def load(self):
        # 1. Linear features (Rodelbahn, Skisprungschanze)
        shp_file_lin = self.base_path + "swissTLM3D_TLM_SPORTBAUTE_LIN.shp"
        try:
            with fiona.open(shp_file_lin) as src:
                for obj in src:
                    obj_type = obj["properties"].get("OBJEKTART", "")
                    if obj_type not in ["Rodelbahn", "Skisprungschanze"]:
                        continue

                    geo = shape(obj["geometry"])
                    name = obj["properties"].get("NAME", "")
                    if not name:
                        name = obj_type

                    centroid = geo.centroid
                    x, y = centroid.x, centroid.y

                    swiss_name = SwissName(
                        name=name,
                        object_type=obj_type,
                        x=int(x),
                        y=int(y),
                        h=0,
                    )
                    self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)
        except Exception:
            pass  # file may not exist in reduced dataset

        # 2. Polygon features (Sportplatz)
        shp_file_ply = self.base_path + "swissTLM3D_TLM_SPORTBAUTE_PLY.shp"
        try:
            with fiona.open(shp_file_ply) as src:
                for obj in src:
                    obj_type = obj["properties"].get("OBJEKTART", "")
                    if obj_type != "Sportplatz":
                        continue

                    geo = shape(obj["geometry"])
                    name = obj["properties"].get("NAME", "")
                    if not name:
                        name = obj_type

                    centroid = geo.centroid
                    x, y = centroid.x, centroid.y

                    swiss_name = SwissName(
                        name=name,
                        object_type=obj_type,
                        x=int(x),
                        y=int(y),
                        h=0,
                    )
                    self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)
        except Exception:
            pass
