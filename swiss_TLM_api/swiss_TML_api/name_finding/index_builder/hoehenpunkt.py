import fiona
from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName


class Hoehenpunkt(IndexBuilder):
    """
    Inserts "Punkt XXX" elevation markers from SMV DKM25_HOEHENKOTE.
    """

    def load(self):
        # 1. Load named peaks from swissNAMES3D
        shp_file = "./resources/swissNAMES3D_data/swissNAMES3D_PKT.shp"

        valid_types = {
            "Gipfel",
            "Haupthuegel",
            "Hauptgipfel",
            "Huegel",
            "Pass",
            "Strassenpass",
            "Aussichtspunkt",
            "Felskopf",
            "Alpiner Gipfel",
        }

        try:
            with fiona.open(shp_file) as src:
                for obj in src:
                    props = obj["properties"]
                    obj_art = props.get("OBJEKTART")

                    if obj_art not in valid_types:
                        continue

                    obj_type = obj_art
                    geo = obj["geometry"]["coordinates"]

                    h = 0
                    if "HOEHE" in props and props["HOEHE"] is not None:
                        h = float(props["HOEHE"])
                    elif len(geo) > 2:
                        h = geo[2]

                    raw_name = props.get("NAME")
                    if raw_name and str(raw_name).strip() != "":
                        name = str(raw_name)
                    else:
                        name = f"Punkt {int(h)}"

                    x, y = geo[0], geo[1]

                    swiss_name = SwissName(
                        name=name,
                        object_type=obj_type,
                        x=int(x),
                        y=int(y),
                        h=int(h),
                    )
                    self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)
        except Exception as e:
            print(f"Error loading {shp_file}: {e}")

        # 2. Load un-named spot elevations from SMV25
        smv25_file = "./resources/swissNAMES3D_data/SMV25_HOEHENKOTEN.shp"
        import os

        if os.path.exists(smv25_file):
            try:
                with fiona.open(smv25_file) as src:
                    for obj in src:
                        props = obj.get("properties", {})
                        h = props.get("HOEHE", 0)

                        geo = obj["geometry"]["coordinates"]
                        x, y = geo[0], geo[1]

                        swiss_name = SwissName(
                            name=f"Punkt {int(h)}",
                            object_type="Kotierter Punkt",
                            x=int(x),
                            y=int(y),
                            h=int(h),
                        )
                        self.index.insert(id=0, coordinates=(x, y), obj=swiss_name)
                print(f"[INFO] Loaded SMV25 Kotierte Punkte successfully.")
            except Exception as e:
                print(f"Error loading {smv25_file}: {e}")
