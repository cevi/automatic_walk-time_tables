from __future__ import annotations

import io
import json
import logging
import os
import pathlib
import shutil
import threading
import time
import uuid as uuid_factory
import zipfile
from threading import Thread

import polyline
import requests
from flask import Flask, request, send_file, redirect
from flask_cors import CORS

from automatic_walk_time_tables.path_transformers.douglas_peucker_transformer import (
    DouglasPeuckerTransformer,
)
from automatic_walk_time_tables.path_transformers.equidistant_transfomer import (
    EquidistantTransformer,
)
from automatic_walk_time_tables.path_transformers.heigth_fetcher_transfomer import (
    HeightFetcherTransformer,
)
from automatic_walk_time_tables.path_transformers.pois_transfomer import POIsTransformer
from automatic_walk_time_tables.utils.error import UserException
from automatic_walk_time_tables.utils.gpx_creator import create_gpx_file
from automatic_walk_time_tables.utils.path import Path, path_from_json
from automatic_walk_time_tables.utils.point import Point_LV95
from server_logging.log_helper import setup_recursive_logger
from server_logging.status_handler import ExportStateHandler, ExportStateLogger

stateHandler = ExportStateHandler()
stateLogger = ExportStateLogger(stateHandler)

# Set logging level from environment variable
log_level = os.environ["LOG_LEVEL"] if "LOG_LEVEL" in os.environ else "INFO"
setup_recursive_logger(log_level, stateLogger)

from automatic_walk_time_tables.generator import AutomatedWalkTableGenerator
from automatic_walk_time_tables.utils.file_parser import GeoFileParser

from automatic_walk_time_tables.generator_status import GeneratorStatus

logger = logging.getLogger(__name__)

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/parse_route", methods=["POST"])
def parse_route():
    options = json.loads(request.form["options"])
    logger.info("Options: {}".format(options))

    file_content = request.form["file_content"]

    try:
        if "file_type" not in options or options["file_type"] is None:
            raise Exception("No file ending provided.")

        if file_content is None:
            raise Exception("No GPX/KML file provided with the POST request.")

        geo_file_parser = GeoFileParser(fetch_elevation=True)
        path = geo_file_parser.parse(
            file_content=file_content, extension=options["file_type"]
        )

        equidistant_transformer = EquidistantTransformer(equidistant_distance=10)
        path = equidistant_transformer.transform(path)

        route = (
            path.to_polyline()
            if "encoding" in options and options["encoding"] == "polyline"
            else path.to_json()
        )
        result_json = {
            "status": GeneratorStatus.SUCCESS,
            "route": route,
            "route_name": path.route_name,
        }

        if path.has_elevation_for_all_points():
            result_json["elevation_data"] = path.to_elevation_polyline()

        return app.response_class(
            response=json.dumps(result_json), status=200, mimetype="application/json"
        )
    except UserException as e:
        logger.error(e)
        return app.response_class(
            response=json.dumps({"status": GeneratorStatus.ERROR, "message": str(e)})
        )
    except Exception as e:
        logger.error("Exception while parsing file: {}".format(e))
        return app.response_class(
            response=json.dumps(
                {
                    "status": GeneratorStatus.ERROR,
                    "message": "Ein Fehler beim Einlesen der Route ist aufgetreten.",
                }
            ),
            status=500,
            mimetype="application/json",
        )


@app.route("/create-walk-time-table", methods=["POST"])
def create_walk_time_table():
    try:
        if request.is_json:
            options = request.get_json()
        elif "options" in request.form:
            options = json.loads(request.form["options"])
        else:
            return app.response_class(
                response=json.dumps(
                    {"status": GeneratorStatus.ERROR, "message": "Die Optionen fehlen."}
                ),
                status=400,
                mimetype="application/json",
            )

        # Decode options['route'] for polyline
        if "encoding" in options and options["encoding"] == "polyline":
            start = time.time()

            path = extract_path(options)

            end = time.time()
            logger.info("Decoding polyline took {} seconds.".format(end - start))

            start = time.time()

            # calc POIs for the path
            pois_transformer = POIsTransformer(
                pois_list_as_str=options["pois"] if "pois" in options else "",
                pois_distance_str=(
                    options["pois_distance"] if "pois_distance" in options else ""
                ),
            )
            pois: Path = pois_transformer.transform(path)

            end = time.time()
            logger.info("Calculating POIs took {} seconds.".format(end - start))
            start = time.time()

            douglas_peucker_transformer = DouglasPeuckerTransformer(
                number_of_waypoints=21, pois=pois
            )

            # we don't use the auto waypoints if the user has disabled them
            if options["auto_waypoints"]:
                selected_way_points = douglas_peucker_transformer.transform(path)
            else:
                selected_way_points = pois

            end = time.time()
            logger.info(
                "Calculating Douglas-Peucker took {} seconds.".format(end - start)
            )

            result_json = {
                "status": GeneratorStatus.SUCCESS,
                "selected_way_points": selected_way_points.to_polyline(),
                "selected_way_points_elevation": selected_way_points.to_elevation_polyline(),
                "pois": pois.to_polyline(),
                "pois_elevation": pois.to_elevation_polyline(),
            }
            return app.response_class(
                response=json.dumps(result_json),
                status=200,
                mimetype="application/json",
            )

        else:
            return app.response_class(
                response=json.dumps(
                    {
                        "status": GeneratorStatus.ERROR,
                        "message": "Die Route kann leider nicht eingelesen werden.",
                    }
                ),
                status=400,
                mimetype="application/json",
            )
    except UserException as e:
        logger.error(e)
        response = json.dumps({"status": GeneratorStatus.ERROR, "message": str(e)})
        return app.response_class(
            response=response, status=500, mimetype="application/json"
        )

    except Exception as e:
        logger.error(e)
        response = json.dumps(
            {"status": GeneratorStatus.ERROR, "message": "Ein Fehler ist aufgetreten."}
        )
        return app.response_class(
            response=response, status=500, mimetype="application/json"
        )


def extract_path(options, coords_field="route", elevation_field="elevation_data"):
    path = Path(
        list(
            map(
                lambda pkt: Point_LV95(lat=pkt[0], lon=pkt[1]),
                polyline.decode(options[coords_field], 0),
            )
        )
    )
    if elevation_field in options:
        elevation_data = polyline.decode(options[elevation_field], 0)
        for i, way_point in enumerate(path.way_points):
            way_point.point.h = elevation_data[i][1]
            way_point.accumulated_distance = elevation_data[i][0]

    else:
        height_fetcher_transformer = HeightFetcherTransformer()
        path = height_fetcher_transformer.transform(path)

    if "settings" in options and "route_name" in options["settings"]:
        path.route_name = options["settings"]["route_name"]
        logger.info("Route loaded with name: {}".format(path.route_name))
    return path


@app.route("/create_map", methods=["POST"])
def create_map():
    uuid = str(uuid_factory.uuid4().hex)

    if request.is_json:
        options = request.get_json()
    elif "options" in request.form:
        options = json.loads(request.form["options"])
    else:
        return app.response_class(
            response=json.dumps(
                {"status": GeneratorStatus.ERROR, "message": "Die Optionen fehlen."}
            ),
            status=400,
            mimetype="application/json",
        )

    thread = Thread(target=create_export, kwargs={"options": options, "uuid": uuid})
    thread.start()

    # Send the download link to the user
    response = app.response_class(
        response=json.dumps({"status": GeneratorStatus.RUNNING, "uuid": str(uuid)}),
        status=200,
        mimetype="application/json",
    )

    return response


def create_export(options, uuid):
    generator = None
    try:
        path, way_points, pois = None, None, None

        # Decode options['route'] form polyline
        if "encoding" in options and options["encoding"] == "polyline":
            start = time.time()

            path = extract_path(options, "route", "route_elevation")
            way_points = extract_path(options, "way_points", "way_points_elevation")

            # calc POIs for the path
            pois_transformer = POIsTransformer(
                pois_list_as_str=options["pois"] if "pois" in options else "",
                pois_distance_str=(
                    options["pois_distance"] if "pois_distance" in options else ""
                ),
            )
            pois: Path = pois_transformer.transform(path)

            end = time.time()
            logger.info("Decoding polylines took {} seconds.".format(end - start))

        output_directory = "output/" + uuid + "/"

        logger.log(
            ExportStateLogger.REQUESTABLE,
            "Export wird vorbereitet.",
            {"uuid": uuid, "status": GeneratorStatus.RUNNING},
        )

        options["print_api_base_url"] = os.environ["PRINT_API_BASE_URL"]
        options["output_directory"] = output_directory

        if "name_points_in_export" not in options["settings"]:
            options["settings"]["name_points_in_export"] = True

        generator = AutomatedWalkTableGenerator(uuid, options)
        generator.set_data(path, way_points, pois)

        store_dict = generator.get_store_dict()
        r = requests.post(os.environ["STORE_API_URL"] + "/store", json=store_dict)
        if r.status_code == 200:
            logger.log(
                ExportStateLogger.REQUESTABLE,
                "Daten abgespeichert.",
                {"uuid": uuid, "status": GeneratorStatus.RUNNING},
            )
        else:
            logger.log(
                ExportStateLogger.REQUESTABLE,
                "Daten nicht abgespeichert.",
                {"uuid": uuid, "status": GeneratorStatus.ERROR},
            )

        generator.run()

        # Create a new thread and start it
        t = threading.Thread(
            target=__delete_after_delay,
            args=(
                output_directory,
                uuid,
            ),
        )
        t.start()

    except UserException as e:
        logger.error(e)
        logger.log(
            ExportStateLogger.REQUESTABLE,
            str(e),
            {"uuid": uuid, "status": GeneratorStatus.ERROR},
        )

    except Exception as e:
        logger.error(e)
        logger.log(
            ExportStateLogger.REQUESTABLE,
            "Der Export ist fehlgeschlagen. Ein unbekannter Fehler ist aufgetreten!",
            {"uuid": uuid, "status": GeneratorStatus.ERROR},
        )
    finally:
        export_state = stateHandler.get_status(uuid)["status"]
        if export_state == GeneratorStatus.RUNNING:
            logger.error("Generator did not stop.")
            logger.log(
                ExportStateLogger.REQUESTABLE,
                "Der Export wurde nicht erfolgreich fertig. Ein unbekannter Fehler ist aufgetreten!",
                {"uuid": uuid, "status": GeneratorStatus.ERROR},
            )


@app.route("/status/<uuid>")
def status(uuid):
    message = stateHandler.get_status(uuid)
    status_code = 200 if message["status"] != GeneratorStatus.ERROR else 400
    response = app.response_class(
        response=json.dumps(message), status=status_code, mimetype="application/json"
    )
    return response


def __delete_after_delay(base_path: str, uuid: str, delay=720):
    logger.info("Waiting for %s seconds before deleting folder %s" % (delay, base_path))

    # Wait for 12 minutes (720 seconds)
    time.sleep(delay)

    # delete and return files
    try:
        # Execute the remaining code
        stateHandler.remove_status(uuid)
        shutil.rmtree(base_path)

    except OSError as e:
        logger.error("Cannot delete files in folder %s : %s" % (base_path, e.strerror))

    logger.info("Deleted folder %s" % base_path)


@app.route("/download/<uuid>")
def download(uuid):
    # Check if export is completed and still present in the 'output' folder
    base_path = pathlib.Path("./output/" + uuid + "/")
    state = stateHandler.get_status(uuid)

    if (state and state["status"] != GeneratorStatus.SUCCESS) or not os.path.exists(
        base_path
    ):
        # check if content type is HTML
        if "text/html" in request.headers.get("Accept", ""):
            frontend_url = os.environ["FRONTEND_DOMAIN"]
            return redirect(frontend_url, code=302)

        # TODO: check if this UUID is stored and therefore we can recreate the export

        return app.response_class(
            response=json.dumps(
                {
                    "status": GeneratorStatus.ERROR,
                    "message": "Die angeforderten Daten sind nicht verfügbar.",
                }
            ),
            status=404,
            mimetype="application/json",
        )

    # Return Zip with data
    data = io.BytesIO()
    with zipfile.ZipFile(data, mode="w") as z:
        for f_name in base_path.iterdir():
            # get only filename from f_name to write the file into the root of the zip
            only_name = str(f_name.name)
            z.write(f_name, only_name)
    data.seek(0)

    return send_file(
        data,
        mimetype="application/zip",
        as_attachment=True,
        download_name="Download.zip",
    )


def fetch_data_for_uuid(uuid):
    r = requests.post(os.environ["STORE_API_URL"] + "/retrieve", json={"uuid": uuid})
    if r.status_code == 200:
        return r.json()
    else:
        return None


@app.route("/retrieve/<uuid>")
def retrieve_route(uuid):
    data = fetch_data_for_uuid(uuid)
    if data is not None:
        options = data["options"]
        # TODO: check if the export folder still exists.
        # if yes: do not export again, but rather just serve the folder
        # if no: do as is now.

        thread = Thread(
            target=create_export, kwargs={"options": options, "uuid": str(uuid)}
        )
        thread.start()

        return app.response_class(
            response=json.dumps({"status": GeneratorStatus.RUNNING, "uuid": str(uuid)}),
            status=200,
            mimetype="application/json",
        )
    else:
        return app.response_class(
            response=json.dumps(
                {
                    "status": GeneratorStatus.ERROR,
                    "message": "Die angeforderte GPX Datei ist nicht verfügbar.",
                }
            ),
            status=404,
            mimetype="application/json",
        )


@app.route("/gpx/<uuid>.gpx")
def generate_gpx(uuid):
    data = fetch_data_for_uuid(uuid)
    if data is not None:
        path = path_from_json(data["path"])
        way_points = path_from_json(data["way_points"])
        gpx_string = create_gpx_file(path, way_points)
        return app.response_class(
            response=gpx_string, status=200, mimetype="application/gpx+xml"
        )
    else:
        return app.response_class(
            response=json.dumps(
                {
                    "status": GeneratorStatus.ERROR,
                    "message": "Die angeforderte GPX Datei ist nicht verfügbar.",
                }
            ),
            status=404,
            mimetype="application/json",
        )


if __name__ == "__main__":
    app.run(
        debug=(os.environ.get("DEBUG", "False").lower() in ("true", "1", "t")),
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
    )
