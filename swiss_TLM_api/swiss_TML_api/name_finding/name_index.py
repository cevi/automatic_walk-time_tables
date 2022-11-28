import glob
import logging
import os
import shutil
import time

import gdown
from rtree.index import Index as RTreeIndex

from swiss_TML_api.name_finding.index_builder.einzelobjekte import Einzelobjekte
from swiss_TML_api.name_finding.index_builder.flurnamen import Flurnamen
from swiss_TML_api.name_finding.index_builder.forest_borders import ForestBorders
from swiss_TML_api.name_finding.index_builder.leisure_areals import LeisureAreals
from swiss_TML_api.name_finding.index_builder.pkt_names import PKTNames
from swiss_TML_api.name_finding.index_builder.stops_and_stations import StopsAndStations
from swiss_TML_api.name_finding.index_builder.tlm_streets import TLM_Streets
from swiss_TML_api.name_finding.index_builder.versorgungsbauten import Versorgungsbauten

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def delete_file(pattern):
    files = glob.glob(pattern)

    for f in files:
        try:
            os.remove(f)
        except OSError as e:
            print("Error: %s : %s" % (f, e.strerror))


class NameIndex:

    def __init__(self, force_rebuild, reduced):

        self.index_file_path = './index_cache/swissname_data_index'

        # Check if index files exist
        # If the index does not exist and force_rebuild is False,
        # we download the index from Google Drive
        if not force_rebuild and not os.path.isfile(self.index_file_path + '.dat'):
            file_id = "1gESYkWDCrAJ06ADBwM-c2SrEpri6I5P0"
            output = "./index_cache/index_cache.tar.xz"
            gdown.download(id=file_id, output=output, quiet=False)
            shutil.unpack_archive(output, "./index_cache/")

        # If force_rebuild is enabled, we recreate the index file.
        if force_rebuild:
            delete_file('./index_cache/*.dat')
            delete_file('./index_cache/*.idx')

        self.index = RTreeIndex(self.index_file_path)

        if self.index.get_size() > 0:
            logger.debug('Index of size {} found  at {}'.format(self.index.get_size(), self.index_file_path))
            return

        if reduced and not any(fname.endswith('.shp') for fname in os.listdir('resources/swissTLM3D_LV95_data/')):
            logger.info('SHP files not found. Downloading them from Swisstopo')

            url = 'https://cms.geo.admin.ch/Topo/swisstlm3d/LV95/swissTLM3D_1.9_LV95_LN02_shp3d.zip'
            folder = './resources/swissTLM3D_LV95_data/'
            self.__download_resources(url, folder)

        if not reduced and not any(fname.endswith('.shp')
                                   for fname in os.listdir('resources/swissTLM3D_LV95_data_full/')):
            logger.info('SHP files not found. Downloading them from Swisstopo')

            url = 'https://data.geo.admin.ch/ch.swisstopo.swisstlm3d/swisstlm3d_2022-03/' \
                  'swisstlm3d_2022-03_2056_5728.shp.zip '
            folder = './resources/swissTLM3D_LV95_data_full/'
            self.__download_resources(url, folder)

        self.generate_index(reduced)

    def __download_resources(self, url: str, destination: str):
        # Download a zip from url and extract it
        output = destination + 'swissTLM3D_LV95_raw.zip'

        # download the zip file and save it in output
        req = requests.get(url, stream=True)
        with open(output, 'wb') as f:
            for chunk in req.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)

        shutil.unpack_archive(filename=output, extract_dir=destination)

        for directory in os.listdir(destination):

            if any(ext in directory for ext in ('.zip', '.gitkeep')):
                continue

            for file in os.listdir(os.path.join(destination, directory)):
                file_name = os.path.join(destination, directory, file)
                shutil.move(file_name, os.path.join(destination, file))

            os.rmdir(os.path.join(destination, directory))
        os.remove(output)

    def generate_index(self, reduced):

        logger.info(
            'Start Creating Index: Save index in {}. This might take a few minutes.'.format(self.index_file_path))

        # TODO: Missing Entries:
        #   -   Kreuzung mit Seilbahnen usw.
        #   -   Türme, Kapelle, Historische Baute aus TLM_GEBAEUDE_FOOTPRINT inkl. Nutzungsinfo z.B. Wasserturm
        #   -   Rodelbahn und Skisprungschanze (evtl. weitere) aus TLM_SPORTBAUTE_LIN
        #   -   Sportplatz aus TLM_SPORTBAUTE_PLY
        #   -   Wehr, Staudamm usw. aus TLM_STAUBAUTE
        #   -   Hochspannungsleitungen aus TLM_VERSORGUNGS_BAUTE_LIN (nur Wegkreuzungen)
        #   -   Kraftwerkareal, Abwasserreinigungsareal, Ruinen und weitere aus aus TLM_NUTZUNGSAREAL
        #   -   Nationalparksgrenzen aus TLM_SCHUTZGEBIET
        #   -   Schulen aus TLM_SCHULE
        #   -   Druckleitung bzw. Fliessgewaesser als Kreuzung mit Weg aus TLM_FLIESSGEWAESSER
        #   -   Add intersections with river that have no bridge (e.g. 2720398, 1178367)

        index_parts = (ForestBorders, TLM_Streets, StopsAndStations, LeisureAreals, Flurnamen, Versorgungsbauten,
                       Einzelobjekte, PKTNames)
        for index_part in index_parts:
            start = time.time()
            logger.info("\tInsertion of {} started...".format(index_part.__name__))

            loader = index_part(self.index, reduced=reduced)
            loader.load()

            end = time.time()
            logger.info("\tInsertion completed. Time needed: {}s".format(end - start))

        logger.info('Creation of index completed')
        self.index.flush()
        logger.info('Index flushed!')
