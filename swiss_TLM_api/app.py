from __future__ import annotations

import logging
import os

from flask import Flask, request, jsonify
from flask_cors import CORS

from swiss_TML_api.logging.log_helper import setup_recursive_logger

setup_recursive_logger(logging.INFO)
logger = logging.getLogger(__name__)

from swiss_TML_api.name_finding.name_finder import NameFinder
from swiss_TML_api.name_finding.name_lookup import find_name
from swiss_TML_api.name_finding.route_features import (
    DEFAULT_CORRIDOR,
    features_along_route,
)
from swiss_TML_api.map_numbers.map_numbers_fetcher import MapNumberIndex

# check if FAULTHANDLER env var is set
if os.environ.get("FAULTHANDLER", "False").lower() in ("true", "1", "t"):
    import faulthandler

    faulthandler.enable()

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})

name_index: NameFinder | None = None
map_number_index: MapNumberIndex | None = None

NAME_CANDIDATES = 200
"""Number of nearest objects of the index considered when naming a coordinate."""


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

    map_number_index = MapNumberIndex(
        force_rebuild=True
    )  # on every start, load the Map numbers from the swisstopo server

    logger.info("=========================================================")
    logger.info("==== SUCCESS: INDEX FULLY LOADED AND READY TO USE ====")
    logger.info("=========================================================")


@app.route("/ready", methods=["GET"])
def ready():
    global name_index, map_number_index
    if name_index is None or map_number_index is None:
        return jsonify({"status": "loading"})
    return jsonify({"status": "ready"})


def _names(coords: list) -> list:
    response = []
    for e, n in coords:
        result = find_name(name_index.get_names(e, n, NAME_CANDIDATES), e, n)
        logger.info(
            "Choose %s (%s) for %s/%s at distance %sm",
            result["swiss_name"],
            result["object_type"],
            e,
            n,
            result["offset"],
        )
        response.append(result)
    return response


MAX_POINTS = 1000
MAX_ROUTE_POINTS = 100_000
"""A route of 1000 km, resampled every 10 m."""


def _is_coordinate_list(points, max_length: int) -> bool:
    return (
        isinstance(points, list)
        and len(points) <= max_length
        and all(
            isinstance(p, list)
            and len(p) == 2
            and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in p)
            for p in points
        )
    )


@app.route("/names", methods=["POST"])
def post_names():
    """
    Names a batch of LV95 coordinates.

    Body: {"points": [[e, n], ...]}
    Response: {"names": [{"swiss_name", "object_type", "offset", "lv95_coord"}, ...]} in the order of the points.
    """
    points = (request.get_json(silent=True) or {}).get("points")
    if not _is_coordinate_list(points, MAX_POINTS):
        return (
            jsonify(
                {
                    "error": f"Expected {{'points': [[e, n], ...]}} with at most {MAX_POINTS} points"
                }
            ),
            400,
        )
    return jsonify({"names": _names(points)})


@app.route("/swiss_name", methods=["GET"])
def get_name():
    """Deprecated: GET with a JSON body [[e, n], ...]. Use POST /names."""
    return jsonify(_names(request.json))


@app.route("/features_along_route", methods=["POST"])
def post_features_along_route():
    """
    All objects of the name index close to a route, used to find landmarks for the waypoint selection.

    Body: {"route": [[e, n], ...], "corridor": 25}
    Response: {"features": [{"name", "object_type", "e", "n", "h", "offset"}, ...]}
    """
    body = request.get_json(silent=True) or {}
    route = body.get("route")
    if not _is_coordinate_list(route, MAX_ROUTE_POINTS):
        return (
            jsonify(
                {
                    "error": f"Expected {{'route': [[e, n], ...]}} with at most {MAX_ROUTE_POINTS} points"
                }
            ),
            400,
        )
    try:
        corridor = float(body.get("corridor", DEFAULT_CORRIDOR))
    except (TypeError, ValueError):
        return jsonify({"error": "corridor must be a number"}), 400
    features = features_along_route(route, name_index.get_names_in_bbox, corridor)
    return jsonify({"features": features})


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
