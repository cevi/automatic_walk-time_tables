from __future__ import annotations

import logging
import pathlib
import time
import os

from automatic_walk_time_tables.generator_status import GeneratorStatus
from automatic_walk_time_tables.geo_processing.map_numbers import fetch_map_numbers
from automatic_walk_time_tables.map_downloader.create_map import MapCreator
from automatic_walk_time_tables.path_transformers.douglas_peucker_transformer import (
    DouglasPeuckerTransformer,
)
from automatic_walk_time_tables.path_transformers.equidistant_transfomer import (
    EquidistantTransformer,
)
from automatic_walk_time_tables.path_transformers.naming_transformer import (
    NamingTransformer,
)
from automatic_walk_time_tables.path_transformers.pois_transfomer import POIsTransformer
from automatic_walk_time_tables.utils import path
from automatic_walk_time_tables.utils import gpx_creator
from automatic_walk_time_tables.utils.file_parser import GeoFileParser
from automatic_walk_time_tables.walk_time_table.walk_table import (
    create_walk_table,
    plot_elevation_profile,
)
from server_logging.status_handler import ExportStateLogger
from automatic_walk_time_tables.utils.error import UserException


class AutomatedWalkTableGenerator:
    def __init__(self, uuid: str, options: dict):
        self.__path: path.Path | None = None
        self.__pois: path.Path | None = None
        self.__way_points: path.Path | None = None

        self.options = options

        self.uuid = uuid
        self.__logger = logging.getLogger(__name__)

        self.__output_directory = (
            options["output_directory"] if options else "output/" + uuid + "/"
        )
        pathlib.Path(self.__output_directory).mkdir(parents=True, exist_ok=True)

    def run(self):
        self.__log_runtime(self.__create_files, "Benötigte Zeit für Export")

        # Export successfully completed
        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            "Export abgeschlossen, die Daten können heruntergeladen werden.",
            {"uuid": self.uuid, "status": GeneratorStatus.SUCCESS},
        )

    def __create_files(self):
        gpx_route_name = self.__path.route_name

        name = (
            self.__output_directory + "Route"
            if gpx_route_name == ""
            else self.__output_directory + gpx_route_name
        )

        # calc POIs for the path
        if self.__pois is None:
            pois_transformer = POIsTransformer(self.options["settings"]["list_of_pois"])
            self.__pois: path.Path = pois_transformer.transform(self.__path)

        # calc points for walk-time table
        if self.__way_points is None:
            douglas_peucker_transformer = DouglasPeuckerTransformer(
                number_of_waypoints=21, pois=self.__pois
            )
            self.__way_points: path.Path = self.__log_runtime(
                douglas_peucker_transformer.transform,
                "Benötigte Zeit zum Berechnen der Marschzeittabelle",
                self.__path,
            )

        equidistant_transformer = EquidistantTransformer(equidistant_distance=1)
        equidistant_way_points: path.Path = equidistant_transformer.transform(
            self.__path
        )

        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            "Route wurde berechnet.",
            {
                "uuid": self.uuid,
                "status": GeneratorStatus.RUNNING,
                "route": equidistant_way_points.to_polyline(),
            },
        )

        naming_fetcher = NamingTransformer()
        self.__way_points = naming_fetcher.transform(self.__way_points)

        self.__log_runtime(
            plot_elevation_profile,
            "Benötigte Zeit zum erstellen des Höhenprofils",
            self.__path,
            self.__way_points,
            self.__pois,
            file_name=name,
            legend_position=self.options["settings"]["legend_position"],
        )
        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            "Höhenprofil wurde erstellt.",
            {"uuid": self.uuid, "status": GeneratorStatus.RUNNING},
        )

        # We use fetch map numbers only for the selected way points,
        # this is much faster that for every point in the original path. As the swiss_TML_api uses a tolerance
        # of 2_000m anyway the chance to miss a map number is very small.

        map_numbers = self.__log_runtime(
            fetch_map_numbers,
            "Benötigte Zeit um die Karten-Nummern zu berechnen",
            self.__way_points,
        )
        self.__logger.debug("Input File Name: %s", name)
        self.__logger.debug("Map Numbers: %s", map_numbers)

        self.__log_runtime(
            create_walk_table,
            "Benötigte Zeit zum Erstellen der Excel-Tabelle",
            self.options["settings"]["departure_time"],
            self.options["settings"]["velocity"],
            self.__way_points,
            route_name=gpx_route_name,
            file_name=name,
            creator_name=self.options["settings"]["creator_name"],
            map_numbers=map_numbers,
        )

        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            "Marschzeittabelle wurde erstellt.",
            {"uuid": self.uuid, "status": GeneratorStatus.RUNNING},
        )

        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            "Karten werden erstellt...",
            {"uuid": self.uuid, "status": GeneratorStatus.RUNNING},
        )
        map_creator = MapCreator(self.__path, self.uuid, self.options["settings"])
        self.__log_runtime(
            map_creator.plot_route_on_map,
            "Benötigte Zeit zum Erstellen der Karten-PDFs",
            self.__way_points,
            pois=self.__pois,
            file_name=name,
            map_scaling=self.options["settings"]["map_scaling"],
            map_layers=list(
                map(
                    lambda layer: layer.strip(),
                    self.options["settings"]["map_layers"].split(","),
                )
            ),
            print_api_base_url=self.options["print_api_base_url"],
        )

        self.__log_runtime(
            self.store_gpx_file,
            "Benötigte Zeit um die GPX-Datei zu erstellen",
            name,
        )
        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            "GPX-Datei erstellt.",
            {"uuid": self.uuid, "status": GeneratorStatus.RUNNING},
        )

    def store_gpx_file(self, name: str):
        gpx_data = gpx_creator.create_gpx_file(self.__path, self.__way_points)      
        with open(f"{name}.gpx", "w") as wr:
            wr.write(gpx_data)

    def __log_runtime(
        self,
        function,
        log_string="Time used",
        *args,
        **kwargs,
    ):
        """
        Logs the time it takes to run the given function.
        """
        start = time.time()
        results = function(*args, **kwargs)
        self.__logger.log(
            ExportStateLogger.REQUESTABLE,
            log_string + ": %ss" % round((time.time() - start), 2),
            {"uuid": self.uuid, "status": GeneratorStatus.RUNNING},
        )
        return results

    def set_data(self, path_data: path.Path, way_points: path.Path, pois: path.Path):
        self.__logger.debug("Setting data for the generator.")
        self.__logger.debug("Length of pois: %s", pois.number_of_waypoints)
        self.__logger.debug("Length of way_points: %s", way_points.number_of_waypoints)
        self.__logger.debug("Length of path_data: %s", path_data.number_of_waypoints)

        self.__path = path_data
        self.__way_points = way_points
        self.__pois = pois

    def get_store_dict(self):

        # name way_points
        naming_fetcher = NamingTransformer(use_default_name=True)
        __way_points = naming_fetcher.transform(self.__way_points)

        return {
            "uuid": self.uuid,
            "options": self.options,
            "path": self.__path.to_json(),
            "pois": self.__pois.to_json(),
            "way_points": __way_points.to_json(),
        }
