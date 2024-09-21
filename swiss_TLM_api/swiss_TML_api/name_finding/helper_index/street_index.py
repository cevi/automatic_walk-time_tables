import logging

import fiona
from rtree.index import Index as RTreeIndex
from shapely.geometry import LineString

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class StreetIndex:
    def __init__(self, shp_file):
        self.index_file_path = "./index_cache/street_index"
        self.shp_file = shp_file

        if not os.path.exists("./index_cache"):
            # If it does not exist, create the directory
            os.makedirs("./index_cache")

    def get_street_index(self, street_types=("Weg", "Strasse", "Wegfragment", "Spur")):
        path_index = RTreeIndex(self.index_file_path)

        if path_index.get_size() > 0:
            logger.debug(
                "\tCached index of size {} found".format(path_index.get_size())
            )
            return path_index

        logger.debug("\tBuild temporary street index:")

        with fiona.open(self.shp_file) as src:
            skipped_objects = set()

            for counter, obj in enumerate(src):
                if not counter % 100_000:
                    logger.debug(
                        "\t -> {} / {} objects added".format(counter, len(src))
                    )

                geo = obj["geometry"]["coordinates"]
                obj_type = obj["properties"]["OBJEKTART"]

                if (
                    any(s in obj_type for s in street_types)
                    and obj["geometry"]["type"] == "LineString"
                ):
                    path = [pkt[:-1] for pkt in geo]  # remove elevation information
                    path = LineString(path)
                    path_index.insert(
                        id=0,
                        coordinates=path.bounds,
                        obj={"geo": geo, "properties": obj["properties"]},
                    )

                else:
                    skipped_objects.add(obj_type)

            if len(skipped_objects):
                logger.info("\tSkipped Objects: {}".format(skipped_objects))

        path_index.flush()
        logger.debug("\tBuild of temporary street index completed.")

        return path_index
