from flask import Flask, request
from flask_cors import CORS
import logging
import pydantic
import uuid
from pymongo import MongoClient

logger = logging.getLogger(__name__)

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})

# TODO: make these load from env
client = MongoClient("awt-mongodb", 27017, username="admin", password="pass")
db = client["awt"]
collection = db["store"]


class StoreData(pydantic.BaseModel):  # TODO
    uuid: pydantic.UUID4


@app.route("/store", methods=["POST"])
def store_data():
    data = request.json
    # generate current timestamp and store as well
    logger.info("/store called with " + str(data))

    collection.insert_one(data)

    return "OK"


class RetrieveData(pydantic.BaseModel):  # TODO
    uuid: pydantic.UUID4


@app.route("/retrieve", methods=["POST"])
def retrieve_data():
    data = request.json
    logger.info("/retrieve called with " + str(data))
    return "OK"
