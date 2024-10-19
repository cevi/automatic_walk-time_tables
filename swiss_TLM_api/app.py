from __future__ import annotations

import logging
import os
from threading import Thread

from flask import Flask, request, jsonify
from flask_cors import CORS
from shapely.geometry import Point

from swiss_TML_api.logging.log_helper import setup_recursive_logger

setup_recursive_logger(logging.INFO)
logger = logging.getLogger(__name__)

from swiss_TML_api.name_finding.name_finder import NameFinder
from swiss_TML_api.name_finding.swiss_name import SwissName
from swiss_TML_api.map_numbers.map_numbers_fetcher import MapNumberIndex

# check if FAULTHANDLER env var is set
if os.environ.get("FAULTHANDLER", "False").lower() in ("true", "1", "t"):
    import faulthandler

    faulthandler.enable()

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})

name_index: NameFinder | None = None
map_number_index: MapNumberIndex | None = None


# The NameFinder is a shared object, thus the index get only loaded once
def _load_indexes():
    logger.info("Loading indexes...")
    global name_index, map_number_index
    try:
        name_index = NameFinder(force_rebuild=False, reduced=False)
    except Exception as e:
        logger.error("Error while loading name index. Forcing rebuild")
        logger.error(e)
        name_index = None
        name_index = NameFinder(force_rebuild=True, reduced=False)

    
    map_number_index = MapNumberIndex(force_rebuild=True) # on every start, load the Map numbers from the swisstopo server


@app.route("/ready", methods=["GET"])
def ready():
    global name_index, map_number_index
    if name_index is None or map_number_index is None:
        return jsonify({"status": "loading"})
    return jsonify({"status": "ready"})


@app.route("/swiss_name", methods=["GET"])
def get_name():
    global name_index
    global map_number_index
    try:
        lv95_coords = request.json
        response = []

        for lat, lon in lv95_coords:
            req_pkt = Point((lat, lon))

            swiss_names = name_index.get_names(lat, lon, 3)
            swiss_name: SwissName = swiss_names[0]

            # If object_type is of type 'Weggabelung' and there exists a Hauptgipfel nearby, we take the Hauptgipfel
            if swiss_name.object_type == "Weggabelung" and len(swiss_names) > 1:
                for n in swiss_names[1:]:
                    tlm_pkt = Point((n.x, n.y))
                    if (
                        n.object_type == "Hauptgipfel"
                        and round(req_pkt.distance(tlm_pkt)) <= 250
                    ):
                        swiss_name.name = "Weggabelung bei " + n.name
                        break

            response.append(
                {
                    "lv95_coord": (swiss_name.x, swiss_name.y),
                    "offset": round(
                        req_pkt.distance(Point((swiss_name.x, swiss_name.y)))
                    ),
                    "swiss_name": swiss_name.name,
                    "object_type": swiss_name.object_type,
                }
            )

        return jsonify(response)
    except Exception as e:
        logger.error("Exception:")
        logger.error(e)
        raise e


# TODO: add an endpoint for POI calculation


@app.route("/map_numbers", methods=["GET"])
def get_map_numbers():
    try:
        lv95_coords = request.json
        return map_number_index.fetch_map_numbers(lv95_coords)
    except Exception as e:
        logger.info("Exception:" + e)
        raise e


def create_app():
    _load_indexes()

    return app
    # app.run(
    #    debug=(os.environ.get("DEBUG", "False").lower() in ("true", "1", "t")),
    #    host="0.0.0.0",
    #    port=int(os.environ.get("PORT", 1848)),
    # )
