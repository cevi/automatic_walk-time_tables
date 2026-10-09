import fiona
from shapely.geometry import shape

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Schutzgebiet(IndexBuilder):
    """
    Inserts Nationalparks from TLM_SCHUTZGEBIET.
    """

    def load(self):
        shp_file = self.base_path + "swissTLM3D_TLM_SCHUTZGEBIET.shp"
        try:
            with fiona.open(shp_file) as src:
                for obj in src:
                    obj_type = obj["properties"].get("OBJEKTART", "")
                    if obj_type != "Nationalpark":
                        continue

                    geo = shape(obj["geometry"])
                    name = obj["properties"].get("NAME", "")
                    if not name:
                        name = "Schweizerischer Nationalpark"

                    # Nationalpark bounds could be huge, but maybe we just add the outer boundary points?
                    # Or the centroid? The centroid of a national park is not very useful if you're on the boundary...
                    # For now, let's insert the centroid, maybe people want the boundary?
                    # "Nationalparksgrenzen" was the user's issue text.
                    # To add borders, we can add points along the exterior boundary.
                    if geo.geom_type == "Polygon":
                        polygons = [geo]
                    elif geo.geom_type == "MultiPolygon":
                        polygons = list(geo.geoms)
                    else:
                        continue

                    skip_step = (
                        100  # Add a point every ~100 coords to not overload index
                    )
                    for poly in polygons:
                        ext_coords = list(poly.exterior.coords)
                        for i, p in enumerate(ext_coords):
                            if i % skip_step == 0:
                                swiss_name = SwissName(
                                    name="Nationalparksgrenze",
                                    object_type="Nationalparksgrenze",
                                    x=int(p[0]),
                                    y=int(p[1]),
                                    h=0,
                                )
                                self.index.insert(
                                    id=0, coordinates=(p[0], p[1]), obj=swiss_name
                                )
        except Exception:
            pass
