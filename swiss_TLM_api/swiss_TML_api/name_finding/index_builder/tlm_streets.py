import fiona

from swiss_TML_api.name_finding.helper_index.flurnamen_index import FlurnamenIndex
from swiss_TML_api.name_finding.helper_index.street_index import StreetIndex
from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class TLM_Streets(IndexBuilder):
    """
    This IndexBuilder inserts all intersections where the name of at least two adjacent streets is known.
    """

    def load(self):
        street_index_builder = StreetIndex(
            self.base_path + "swissTLM3D_TLM_STRASSE.shp"
        )
        path_index = street_index_builder.get_street_index(bounds=self.bounds)

        shp_file = self.base_path + "swissTLM3D_TLM_STRASSENINFO.shp"

        flurname_index_builder = FlurnamenIndex(
            self.base_path + "swissTLM3D_TLM_FLURNAME.shp"
        )
        flurname_index = flurname_index_builder.get_flurname_index()

        with fiona.open(shp_file) as src:
            for obj in src:
                # TODO: filter out Autobahnen etc.
                # But add unterführungen Autobahnen (e.g. 2753002.9, 1177063.3)

                geo = obj["geometry"]["coordinates"]
                obj_type = obj["properties"]["OBJEKTART"]

                if obj_type == "Standardknoten":
                    search_area = (geo[0] - 1, geo[1] - 1, geo[0] + 1, geo[1] + 1)

                    # TODO: false positives possible (streets are inserted as bounding boxes), post filtering needed!
                    adjoined_streets = list(
                        path_index.intersection(coordinates=search_area, objects="raw")
                    )
                    street_count = len(adjoined_streets)

                    street_names = set(
                        [
                            obj["properties"]["STRNAME"]
                            for obj in adjoined_streets
                            if obj["properties"]["STRNAME"]
                        ]
                    )

                    list_of_street_names = " " if len(street_names) else ""
                    list_of_street_names += ", ".join(str(s) for s in street_names)

                    is_roundabout = any(
                        [
                            obj["properties"]["KREISEL"] == "Wahr"
                            for obj in adjoined_streets
                        ]
                    )

                    # TODO: prefer nearest Siedlungsnamen over Flurnamen if no street name is available
                    if not len(street_names):
                        flurnamen: SwissName = next(
                            flurname_index.nearest(
                                coordinates=geo[0:2], num_results=1, objects="raw"
                            )
                        )

                        list_of_street_names = " bei {}".format(flurnamen.name)

                    if street_count >= 3 and len(street_names) >= 2:
                        name = "Kreuzung{}".format(list_of_street_names)
                        swiss_name = SwissName(
                            name=name,
                            object_type="Kreuzung",
                            x=int(geo[0]),
                            y=int(geo[1]),
                            h=geo[2],
                        )
                        self.index.insert(id=0, coordinates=geo[0:2], obj=swiss_name)

                    elif is_roundabout and len(street_names):
                        name = "Kreisel Ausfahrt{}".format(list_of_street_names)
                        swiss_name = SwissName(
                            name=name,
                            object_type="Kreisel",
                            x=int(geo[0]),
                            y=int(geo[1]),
                            h=geo[2],
                        )
                        self.index.insert(id=0, coordinates=geo[0:2], obj=swiss_name)

                    elif street_count >= 3:
                        name = "Weggabelung{}".format(list_of_street_names)
                        swiss_name = SwissName(
                            name=name,
                            object_type="Weggabelung",
                            x=int(geo[0]),
                            y=int(geo[1]),
                            h=geo[2],
                        )
                        self.index.insert(id=0, coordinates=geo[0:2], obj=swiss_name)

                    # TODO: False remove false positives, e.g. landwirtschaftliche Brücken (2659510, 1173067)
                    # Can be done by adding a minimal street length
                    elif street_count == 1:
                        name = "Wegende{}".format(list_of_street_names)
                        swiss_name = SwissName(
                            name=name,
                            object_type="Wegende",
                            x=int(geo[0]),
                            y=int(geo[1]),
                            h=geo[2],
                        )
                        self.index.insert(id=0, coordinates=geo[0:2], obj=swiss_name)

        shp_file = self.base_path + "swissTLM3D_TLM_STRASSE.shp"

        with fiona.open(shp_file) as src:
            for obj in src:
                if (
                    obj["properties"]["KUNSTBAUTE"] not in ("Keine", "k_W")
                    and obj["geometry"]["type"] == "LineString"
                ):
                    geo = obj["geometry"]["coordinates"]
                    obj_type = obj["properties"]["KUNSTBAUTE"]
                    wanderweg = obj["properties"]["WANDERWEGE"]

                    name = obj_type + (" ({})".format(wanderweg) if wanderweg else "")

                    for pkt in geo:
                        swiss_name = SwissName(
                            name=name,
                            object_type=obj_type,
                            x=int(pkt[0]),
                            y=int(pkt[1]),
                            h=int(pkt[2]),
                        )
                        self.index.insert(
                            id=0, coordinates=(pkt[0], pkt[1]), obj=swiss_name
                        )
