import logging

import fiona

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)

SWISSNAMES3D_PKT = "./resources/swissNAMES3D_data/swissNAMES3D_PKT.shp"

BUILDING_USES = {
    "Gasthof abgelegen": "Gasthof abgelegen",
    "Schutzhuette": "Schutzhuette",
    "Aussichtsturm": "Aussichtsturm",
    "k_W": "Gebaeude",
}
"""
Named buildings of swissNAMES3D that are landmarks for hikers, by their use (GEBAEUDENUTZUNG) and the object type
they get in the index: remote inns and mountain hotels (e.g. "Bättmer-Hitta"), shelters, observation towers, and
named buildings without a recorded use ("k_W": about half of them are huts like "Blattihütte", the others chalets,
mountain restaurants, ...).
"""


class NamedBuildings(IndexBuilder):
    """
    Inserts named huts, remote inns, shelters and observation towers from swissNAMES3D.

    The Gebaeude builder looks for "abgelegener gasthof" in the use of the TLM building footprints, but the data
    says "Gasthof abgelegen", so these buildings were missing from the index.
    """

    def __init__(self, index, reduced=False, uses=None):
        super().__init__(index, reduced)
        self.uses = uses or BUILDING_USES

    def load(self):
        count = 0
        try:
            with fiona.open(SWISSNAMES3D_PKT) as src:
                for obj in src:
                    props = obj["properties"]
                    # the product information spells the coded values with underscores ("Gasthof_abgelegen"),
                    # the 2024/25 exports with a space
                    use = props.get("GEBAEUDENU") or ""
                    if use != "k_W":
                        use = use.replace("_", " ")
                    name = props.get("NAME")
                    if (
                        props.get("OBJEKTART") != "Gebaeude"
                        or use not in self.uses
                        or not name
                        # only the official name, not the usual or foreign ones ("Tenigerbad" for "Bogn Tenigia")
                        or props.get("STATUS", "offiziell") != "offiziell"
                    ):
                        continue

                    coords = obj["geometry"]["coordinates"]
                    h = coords[2] if len(coords) > 2 else 0
                    swiss_name = SwissName(
                        name=str(name),
                        object_type=self.uses[use],
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
