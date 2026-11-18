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
from swiss_TML_api.name_finding.name_ranking import classify, is_lake, rank
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


@app.route("/swiss_name", methods=["GET"])
def get_name():
    global name_index
    global map_number_index
    try:
        lv95_coords = request.json
        response = []

        for lat, lon in lv95_coords:
            req_pkt = Point((lat, lon))

            swiss_names = name_index.get_names(lat, lon, 200)

            best_n = None
            best_rank = None

            candidates_log = []
            for n in swiss_names:
                # Filter out Trockenrinne (Dry Gully) and pressure pipelines completely
                if n.object_type in (
                    "Trockenrinne",
                    "Druckleitung einfach",
                    "Druckleitung mehrfach",
                    "Druckstollen",
                ):
                    continue

                dist = round(req_pkt.distance(Point((n.x, n.y))))

                # Dynamically prettify Fliessgewaesser names without modifying the static index
                if n.name and "fliessgewaesser (keine brücke)" in n.name.lower():
                    n.name = n.name.replace(
                        "Fliessgewaesser (Keine Brücke)", "Gewässerquerung"
                    )

                category = classify(n.name, n.object_type)
                prio, max_d = category.priority, category.max_distance

                candidates_log.append(
                    {
                        "name": n.name,
                        "type": n.object_type,
                        "dist": dist,
                        "prio": prio,
                        "max_d": max_d,
                        "valid": dist <= max_d,
                    }
                )

                if dist <= max_d:
                    candidate_rank = rank(category, dist)
                    if best_rank is None or candidate_rank > best_rank:
                        best_rank = candidate_rank
                        best_n = n

            candidates_log.sort(key=lambda x: (not x["valid"], -x["prio"], x["dist"]))
            logger.info("--- Top Candidates near %s/%s ---", lat, lon)
            for c in candidates_log[:7]:
                logger.info(
                    "  [%s] %s (%s) - dist: %sm, prio: %s, max_d: %s",
                    "VALID" if c["valid"] else " EXCL",
                    c["name"],
                    c["type"],
                    c["dist"],
                    c["prio"],
                    c["max_d"],
                )

            # Fallback if no object was within its max_d radius
            if not best_n:
                valid_fallbacks = [
                    n for n in swiss_names if n.name and str(n.name).strip() != ""
                ]
                if valid_fallbacks:
                    swiss_name = valid_fallbacks[0]
                else:
                    swiss_name = swiss_names[0]
            else:
                swiss_name = best_n

            if (
                is_lake(swiss_name.name, swiss_name.object_type)
                and f"({int(swiss_name.h)})" not in swiss_name.name
                and swiss_name.h > 0
            ):
                swiss_name.name = f"{swiss_name.name} ({int(swiss_name.h)})"

            # append Peak name to Gipfelkreuz
            if swiss_name.object_type == "Gipfelkreuz":
                best_peak = None
                best_peak_dist = 99999
                for n in swiss_names:
                    if n.object_type in ("Hauptgipfel", "Gipfel"):
                        tlm_pkt = Point((n.x, n.y))
                        d = round(req_pkt.distance(tlm_pkt))
                        if d < best_peak_dist and d <= 250:
                            best_peak = n
                            best_peak_dist = d
                if best_peak:
                    swiss_name.name = f"Gipfelkreuz {best_peak.name}"

            # append nearby Flurname to Kotierter Punkt
            if (
                swiss_name.object_type == "Kotierter Punkt"
                or swiss_name.name.startswith("Punkt ")
            ):
                best_flurname = None
                best_flur_dist = 99999
                for n in swiss_names:
                    obj_lower = n.object_type.lower() if n.object_type else ""
                    if "flurname" in obj_lower or "lokalname" in obj_lower:
                        tlm_pkt = Point((n.x, n.y))
                        d = round(req_pkt.distance(tlm_pkt))
                        if d < best_flur_dist and d <= 250:
                            best_flurname = n
                            best_flur_dist = d
                if best_flurname:
                    swiss_name.name = f"{swiss_name.name} ({best_flurname.name})"

            # If object_type is of type 'Weggabelung' and there exists a Hauptgipfel nearby, we take the Hauptgipfel
            if swiss_name.object_type == "Weggabelung":
                for n in swiss_names:
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

            logger.info(
                f"Choose {swiss_name.name} for {swiss_name.x}/{swiss_name.y} at distance {req_pkt.distance(Point((swiss_name.x, swiss_name.y)))}"
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
