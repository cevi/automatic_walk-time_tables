import logging
import multiprocessing
import queue
import threading

import fiona
from rtree.index import Index as RTreeIndex
from shapely.geometry import LineString

from swiss_TML_api.name_finding.index_builder.index_builder import IndexBuilder
from swiss_TML_api.name_finding.swiss_name import SwissName

logger = logging.getLogger(__name__)


class ForestBorders(IndexBuilder):

    def load(self):
        self.insert_forest_intersections(
            ['swissTLM3D_TLM_BODENBEDECKUNG.shp'])  # , 'swissTLM3D_TLM_BODENBEDECKUNG_ost.shp'])

    def calc_intersection(self, path_index, obj):
        geo = obj["geometry"]['coordinates'][0]
        obj_type = obj['properties']['OBJEKTART']

        intersections = set()

        if obj_type in ['Wald'] and obj["geometry"]['type'] == 'Polygon':

            geo = list(map(lambda p: p[:-1], geo))  # remove elevation information

            polygon = LineString(geo)
            paths = path_index.intersection(coordinates=polygon.bounds, objects='raw')

            for path in paths:

                path = LineString(path)
                inters = polygon.intersection(path)

                if inters.geom_type == 'Point':
                    intersections.add((int(inters.x), int(inters.y)))

                elif inters.geom_type == 'MultiPoint':
                    for pkt in inters.geoms:
                        intersections.add((int(pkt.x), int(pkt.y)))

                elif inters.geom_type == 'LineString':
                    for pkt in inters.coords:
                        intersections.add((int(pkt[0]), int(pkt[1])))

        return intersections

    def insert_forest_intersections(self, shp_files):

        # Check if path index exists, if not it will be build
        base_path = './res/swissTLM3D_1.9_LV95_LN02_shp3d/'
        path_index = self.get_street_index(base_path + 'swissTLM3D_TLM_STRASSE.shp')
        path_index.close()  # as we use multiprocessing we have to reload the index for each thread

        pois = set()

        for shp_file in shp_files:
            pois = pois.union(self.process_shp_file(shp_file))

            logger.debug("\t -> insert {} results to index".format(len(pois)))
            for poi in pois:
                self.index.insert(id=0,
                                  coordinates=poi,
                                  obj=SwissName(name="Waldrand", object_type="Waldrand", x=poi[0], y=poi[1], h=0))

            logger.debug("\t -> insertion completed")

    def process_shp_file(self, shp_file):
        base_path = './res/swissTLM3D_1.9_LV95_LN02_shp3d/'

        # Calculate intersections with forest
        with fiona.open(base_path + shp_file) as src:

            q = queue.Queue()
            intersections = set()
            lock = threading.Lock()

            def worker(res_set, set_lock):

                path_index = self.get_street_index(base_path + 'swissTLM3D_TLM_STRASSE.shp')

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
            logger.debug("\t -> populate queue with batches of size {}".format(batch_size))

            # TODO: Fix: Collection slicing is deprecated and will be disabled in a future version.
            for obj in [src[i:i + batch_size] for i in range(0, len(src), batch_size)]:
                q.put(obj)

            # Split work over multiple workers (n = number of CPU kernels)
            n_workers = multiprocessing.cpu_count()
            logger.debug("\t -> starting {} workers".format(n_workers))
            for i in range(n_workers):
                threading.Thread(target=worker, args=(intersections, lock), daemon=True).start()

            logger.debug("\t -> {} workers got started".format(n_workers))
            q.join()
            logger.debug("\t -> parallel work completed")

            return intersections

    def get_street_index(self, shp_file, street_types=('Weg', 'Strasse')):

        index_file_path = './index_cache/street_index'
        path_index = RTreeIndex(index_file_path)

        if path_index.get_size() > 0:
            logger.debug('\tCached index of size {} found'.format(path_index.get_size()))
            return path_index

        logger.debug("\tBuild temporary street index:")

        with fiona.open(shp_file) as src:
            skipped_objects = set()

            for counter, obj in enumerate(src):

                if not counter % 100_000:
                    logger.debug('\t -> {} / {} objects added'.format(counter, len(src)))

                geo = obj["geometry"]['coordinates']
                obj_type = obj['properties']['OBJEKTART']

                if any(s in obj_type for s in street_types) and obj["geometry"]['type'] == 'LineString':
                    path = [pkt[:-1] for pkt in geo]  # remove elevation information
                    path = LineString(path)
                    path_index.insert(id=0, coordinates=path.bounds, obj=geo)

                else:
                    skipped_objects.add(obj_type)

            if len(skipped_objects):
                logger.info("\tSkipped Objects: {}".format(skipped_objects))

        path_index.flush()
        logger.debug("\tBuild of temporary street index completed.")

        return path_index
