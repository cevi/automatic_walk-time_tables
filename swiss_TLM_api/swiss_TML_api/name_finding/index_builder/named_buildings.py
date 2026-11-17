import logging

import fiona

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)

SWISSNAMES3D_PKT = "./resources/swissNAMES3D_data/swissNAMES3D_PKT.shp"

BUILDING_USES = {"Gasthof abgelegen", "Schutzhuette", "Aussichtsturm"}
"""
Named buildings of swissNAMES3D that are landmarks for hikers: remote inns and mountain huts
(e.g. "Bättmer-Hitta"), shelters and observation towers. The object type in the index is the use.
"""


class NamedBuildings(IndexBuilder):
    """
    Inserts named huts, remote inns, shelters and observation towers from swissNAMES3D.

    The Gebaeude builder looks for "abgelegener gasthof" in the use of the TLM building footprints, but the data
    says "Gasthof abgelegen", so these buildings were missing from the index.
    """

    def load(self):
        count = 0
        try:
            with fiona.open(SWISSNAMES3D_PKT) as src:
                for obj in src:
                    props = obj["properties"]
                    use = props.get("GEBAEUDENU")
                    name = props.get("NAME")
                    if (
                        props.get("OBJEKTART") != "Gebaeude"
                        or use not in BUILDING_USES
                        or not name
                    ):
                        continue

                    coords = obj["geometry"]["coordinates"]
                    h = coords[2] if len(coords) > 2 else 0
                    swiss_name = SwissName(
                        name=str(name),
                        object_type=use,
                        x=int(coords[0]),
                        y=int(coords[1]),
                        h=int(h),
                    )
                    self.index.insert(
                        id=0, coordinates=(coords[0], coords[1]), obj=swiss_name
                    )
                    count += 1
        except Exception as e:
            logger.error("Error loading %s: %s", SWISSNAMES3D_PKT, e)
        logger.info("Inserted %d named buildings", count)
