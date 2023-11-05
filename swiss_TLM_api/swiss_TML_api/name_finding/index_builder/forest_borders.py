import logging
import multiprocessing
import queue
import threading

import fiona
from shapely.geometry import LineString

from swiss_TML_api.name_finding.helper_index.flurnamen_index import FlurnamenIndex
from swiss_TML_api.name_finding.helper_index.street_index import StreetIndex
from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class ForestBorders(IndexBuilder):
    """
    This IndexBuilder inserts all points where a path or road enters the forest.
    """

    def load(self):
        if self.reduced:
            self.insert_forest_intersections(["swissTLM3D_TLM_BODENBEDECKUNG.shp"])
        else:
            self.insert_forest_intersections(
                [
                    "swissTLM3D_TLM_BODENBEDECKUNG_WEST.shp",
                    "swissTLM3D_TLM_BODENBEDECKUNG_OST.shp",
                ]
            )

    def calc_intersection(self, path_index, obj):
        geo = obj["geometry"]["coordinates"][0]
        obj_type = obj["properties"]["OBJEKTART"]

        intersections = set()

        if obj_type in ["Wald"] and obj["geometry"]["type"] == "Polygon":
            geo = list(map(lambda p: p[:-1], geo))  # remove elevation information

            polygon = LineString(geo)
            paths = path_index.intersection(coordinates=polygon.bounds, objects="raw")

            for path in paths:
                path = LineString(path["geo"])
                inters = polygon.intersection(path)

                if inters.geom_type == "Point":
                    intersections.add((int(inters.x), int(inters.y)))

                elif inters.geom_type == "MultiPoint":
                    for pkt in inters.geoms:
                        intersections.add((int(pkt.x), int(pkt.y)))

                elif inters.geom_type == "LineString":
                    for pkt in inters.coords:
                        intersections.add((int(pkt[0]), int(pkt[1])))

        return intersections

    def insert_forest_intersections(self, shp_files):
        print(self.base_path)
        # Check if path index exists, if not it will be build
        street_index_builder = StreetIndex(
            self.base_path + "swissTLM3D_TLM_STRASSE.shp"
        )
        path_index = street_index_builder.get_street_index()
        path_index.close()  # as we use multiprocessing we have to reload the index for each thread

        flurname_index_builder = FlurnamenIndex(
            self.base_path + "swissTLM3D_TLM_FLURNAME.shp"
        )
        flurname_index = flurname_index_builder.get_flurname_index()

        pois = set()

        for shp_file in shp_files:
            pois = pois.union(self.process_shp_file(shp_file))

            logger.debug("\t -> insert {} results to index".format(len(pois)))
            for poi in pois:
                flurname: SwissName = next(
                    flurname_index.nearest(
                        coordinates=poi, num_results=1, objects="raw"
                    )
                )
                name = "Waldrand bei {}".format(flurname.name)
                self.index.insert(
                    id=0,
                    coordinates=poi,
                    obj=SwissName(
                        name=name, object_type="Waldrand", x=poi[0], y=poi[1], h=0
                    ),
                )

            logger.debug("\t -> insertion completed")

    def process_shp_file(self, shp_file):
        # Calculate intersections with forest
        with fiona.open(self.base_path + shp_file) as src:
            q = queue.Queue()
            intersections = set()
            lock = threading.Lock()

            def worker(res_set, set_lock):
                street_index_builder = StreetIndex(
                    self.base_path + "swissTLM3D_TLM_STRASSE.shp"
                )
                path_index = street_index_builder.get_street_index()

                while True:
                    batch = q.get()

                    batch_set = []
                    for o in batch:
                        batch_set.append(self.calc_intersection(path_index, o))

                    # merge results
                    set_lock.acquire()
                    res_set.update(*batch_set)  # we need update here and not union!
                    set_lock.release()

                    logger.debug("\t -> a worker has completed a batch")

                    q.task_done()

            batch_size = 20_000  # the workers process the elements in batches, was recognised empirically as faster
            logger.debug(
                "\t -> populate queue with batches of size {}".format(batch_size)
            )

            # TODO: Fix: Collection slicing is deprecated and will be disabled in a future version.
            for obj in [
                src[i : i + batch_size] for i in range(0, len(src), batch_size)
            ]:
                q.put(obj)

            # Split work over multiple workers (n = number of CPU kernels)
            n_workers = multiprocessing.cpu_count()
            logger.debug("\t -> starting {} workers".format(n_workers))
            for i in range(n_workers):
                threading.Thread(
                    target=worker, args=(intersections, lock), daemon=True
                ).start()

            logger.debug("\t -> {} workers got started".format(n_workers))
            q.join()
            logger.debug("\t -> parallel work completed")

            return intersections
