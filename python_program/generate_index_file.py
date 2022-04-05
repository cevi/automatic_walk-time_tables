import logging

from server_logging.log_helper import setup_recursive_logger

setup_recursive_logger(logging.INFO)

from automatic_walk_time_tables.geo_processing.name_finding.name_index import NameIndex

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    # Set up the root handler
    name_index = NameIndex()
