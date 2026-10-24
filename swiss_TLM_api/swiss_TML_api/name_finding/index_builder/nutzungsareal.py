import fiona
from shapely.geometry import shape

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Nutzungsareal(IndexBuilder):
    """
    Inserts Kraftwerkareal, Abwasserreinigungsareal, Ruinen from TLM_NUTZUNGSAREAL.
    """

    def load(self):
        shp_file = self.base_path + "swissTLM3D_TLM_NUTZUNGSAREAL.shp"
        try:
            with fiona.open(shp_file) as src:
                for obj in src:
                    obj_type = obj["properties"].get("OBJEKTART", "")

                    if obj_type not in [
                        "Kraftwerkareal",
                        "Abwasserreinigungsareal",
                        "Ruinenareal",
                    ]:
                        continue

                    geo = shape(obj["geometry"])
                    name = obj["properties"].get("NAME", "")
                    if not name:
                        name = obj_type
                    elif obj_type == "Ruinenareal" and "ruine" not in name.lower():
                        name = f"Ruine {name}"

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
