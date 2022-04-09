import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from shapely.geometry import Point

from swiss_TML_api.name_finding.name_finder import NameFinder
from swiss_TML_api.name_finding.swiss_name import SwissName

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})


@app.route('/swiss_name', methods=['GET'])
def get_name():
    lv95_coords = request.json
    response = []

    for (lat, lon) in lv95_coords:
        name_index = NameFinder()
        names = name_index.get_names(lat, lon, 1)
        name: SwissName = names[0]

        req_pkt = Point((lat, lon))
        tlm_pkt = Point((name.x, name.y))

        response.append({
            "lv95_coord": (name.x, name.y),
            "offset": round(req_pkt.distance(tlm_pkt)),
            "swiss_name": name.name,
            "object_type": name.object_type
        })

    return jsonify(response)


if __name__ == "__main__":
    app.run(debug=(os.environ.get("DEBUG", "False").lower() in ('true', '1', 't')), host="0.0.0.0",
            port=int(os.environ.get("PORT", 1848)))
