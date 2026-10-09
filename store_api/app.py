from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import pydantic
import uuid
from datetime import datetime, time, timedelta, timezone
from pymongo import MongoClient
from flask_pydantic import validate
import os

logger = logging.getLogger(__name__)

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})

username = os.environ["MONGO_INITDB_ROOT_USERNAME"]
password = os.environ["MONGO_INITDB_ROOT_PASSWORD"]

client = MongoClient("awt-mongodb", 27017, username=username, password=password)
db = client.get_database("awt")
collection = db.get_collection("store")


class StoreData(pydantic.BaseModel):
    uuid: str
    options: dict  # json
    path: dict  # json
    pois: dict  # json
    way_points: dict  # json


@app.route("/store", methods=["POST"])
@validate()
def store_data(body: StoreData):
    current_time = datetime.now(tz=timezone.utc)
    data = {
        "timestamp": current_time,
        "uuid": body.uuid,
        "options": body.options,
        "path": body.path,
        "pois": body.pois,
        "way_points": body.way_points,
    }

    already_in = collection.find_one({"uuid": body.uuid})
    if already_in == None:
        collection.insert_one(data)
    return "OK"


class RequestData(pydantic.BaseModel):
    uuid: str


@app.route("/retrieve", methods=["POST"])
@validate()
def retrieve_data(body: RequestData):
    db_data = collection.find_one({"uuid": body.uuid})
    return StoreData(**db_data)


@app.route("/statistics", methods=["GET"])
def retrieve_statistics():
    days = request.args.get("days", default=30, type=int)
    if days is None or days < 1:
        return jsonify({"message": "Parameter 'days' must be a positive integer."}), 400

    today_utc = datetime.now(tz=timezone.utc).date()
    start_date = datetime.combine(
        today_utc - timedelta(days=days - 1), time.min, tzinfo=timezone.utc
    )
    end_date = datetime.combine(
        today_utc + timedelta(days=1), time.min, tzinfo=timezone.utc
    )

    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date, "$lt": end_date}}},
        {
            "$project": {
                "day": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$timestamp",
                        "timezone": "UTC",
                    }
                },
                "route_length_m": {
                    "$ifNull": [
                        {"$arrayElemAt": ["$path.way_points.accumulated_distance", -1]},
                        0,
                    ]
                },
            }
        },
        {
            "$group": {
                "_id": "$day",
                "routes_count": {"$sum": 1},
                "total_length_m": {"$sum": "$route_length_m"},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    aggregation_results = list(collection.aggregate(pipeline))
    daily_stats_lookup = {
        item["_id"]: {
            "date": item["_id"],
            "routesCount": item["routes_count"],
            "totalLengthM": item["total_length_m"],
        }
        for item in aggregation_results
    }

    daily_stats = []
    total_length_m = 0.0
    total_routes = 0
    for day_offset in range(days):
        current_day = start_date + timedelta(days=day_offset)
        day_key = current_day.strftime("%Y-%m-%d")
        point = daily_stats_lookup.get(
            day_key,
            {"date": day_key, "routesCount": 0, "totalLengthM": 0.0},
        )
        daily_stats.append(point)
        total_length_m += point["totalLengthM"]
        total_routes += point["routesCount"]

    return jsonify(
        {
            "days": days,
            "rangeStart": start_date.strftime("%Y-%m-%d"),
            "rangeEnd": (end_date - timedelta(days=1)).strftime("%Y-%m-%d"),
            "dailyStats": daily_stats,
            "totalRoutes": total_routes,
            "totalLengthM": total_length_m,
        }
    )
