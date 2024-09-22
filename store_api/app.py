from flask import Flask, request
from flask_cors import CORS
import logging
import pydantic
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from flask_pydantic import validate
import os

logger = logging.getLogger(__name__)

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})

username = os.environ["MONGO_INITDB_ROOT_USERNAME"]
password = os.environ["MONGO_INITDB_ROOT_PASSWORD"]

logger.info("Connecting to database")
client = MongoClient("awt-mongodb", 27017, username=username, password=password)
db = client.get_database("awt")
collection = db.get_collection("store")
logger.info("Got collection: " + str(colletion))


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
