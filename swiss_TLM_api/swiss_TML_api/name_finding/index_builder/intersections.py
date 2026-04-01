import fiona
import logging
from shapely.geometry import shape, Point, MultiPoint, LineString

from swiss_TML_api.name_finding.helper_index.street_index import StreetIndex
from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)


class Intersections(IndexBuilder):
    """
    Inserts crossings of paths with Versorgungsbauten, Fliessgewaesser, Seilbahn.
    """

    def load(self):
        street_index_builder = StreetIndex(
            self.base_path + "swissTLM3D_TLM_STRASSE.shp"
        )
        path_index = street_index_builder.get_street_index()

        self._process_file(
            path_index, 
            "swissTLM3D_TLM_VERSORGUNGS_BAUTE_LIN.shp", 
            "Kreuzung Hochspannungsleitung", 
            ["Hochspannungsleitung"]
        )
        self._process_file(
            path_index, 
            "swissTLM3D_TLM_SEILBAHN.shp", 
            "Kreuzung Seilbahn", 
            None # all object_types
        )
        self._process_file(
            path_index, 
            "swissTLM3D_TLM_FLIESSGEWAESSER.shp", 
            "Gewässerquerung", 
            ["Fliessgewaesser", "Bisse Suone"],
            river_mode=True
        )

    def _process_file(self, path_index, filename, base_name, types_to_include, river_mode=False):
        import os
        shp_file = self.base_path + filename
        if not os.path.exists(shp_file):
            return

        try:
            with fiona.open(shp_file) as src:
                for obj in src:
                    obj_type = obj["properties"].get("OBJEKTART", "")
                    
                    if types_to_include and obj_type not in types_to_include:
                        continue

                    geo = shape(obj["geometry"])
                    if geo.geom_type not in ['LineString', 'MultiLineString']:
                        continue

                    # Search for street intersections
                    search_area = geo.bounds
                    adjoined_streets = list(
                        path_index.intersection(coordinates=search_area, objects="raw")
                    )
                    
                    for street in adjoined_streets:
                        # For rivers, skip if the street has a bridge (KUNSTBAUTE != 'Keine' or 'k_W')
                        if river_mode:
                            kunst = street.get("properties", {}).get("KUNSTBAUTE", "")
                            if kunst not in ("Keine", "k_W"):
                                continue
                        
                        street_coords = street["geo"]
                        street_geo = LineString([p[:-1] for p in street_coords])
                        
                        if geo.intersects(street_geo):
                            intersection = geo.intersection(street_geo)
                            
                            points = []
                            if intersection.geom_type == 'Point':
                                points.append(intersection)
                            elif intersection.geom_type == 'MultiPoint':
                                points.extend(list(intersection.geoms))
                                
                            for pt in points:
                                name = base_name
                                
                                # Optionally append specific object name if available
                                obj_name = obj["properties"].get("NAME", "")
                                if obj_name:
                                    name = f"{name} ({obj_name})"
                                    
                                swiss_name = SwissName(
                                    name=name,
                                    object_type=obj_type,
                                    x=int(pt.x),
                                    y=int(pt.y),
                                    h=0,
                                )
                                self.index.insert(id=0, coordinates=(pt.x, pt.y), obj=swiss_name)
        except Exception as e:
            logger.info(f"Failed to process intersection for {filename}: {e}")
