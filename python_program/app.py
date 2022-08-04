from __future__ import annotations

import argparse
import functools
import io
import json
import logging
import os
import pathlib
import shutil
import uuid as uuid_factory
import zipfile
from threading import Thread

import polyline
from flask import Flask, request, send_file
from flask_cors import CORS

from automatic_walk_time_tables.path_transformers.douglas_peucker_transformer import DouglasPeuckerTransformer
from automatic_walk_time_tables.path_transformers.equidistant_transfomer import EquidistantTransformer
from automatic_walk_time_tables.path_transformers.heigth_fetcher_transfomer import HeightFetcherTransformer
from automatic_walk_time_tables.path_transformers.pois_transfomer import POIsTransformer
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV95
from server_logging.log_helper import setup_recursive_logger
from server_logging.status_handler import ExportStateHandler, ExportStateLogger

stateHandler = ExportStateHandler()
stateLogger = ExportStateLogger(stateHandler)
setup_recursive_logger(logging.INFO, stateLogger)

from automatic_walk_time_tables.generator import AutomatedWalkTableGenerator
from automatic_walk_time_tables.utils.file_parser import GeoFileParser

from automatic_walk_time_tables.arg_parser import get_parser
from automatic_walk_time_tables.generator_status import GeneratorStatus

logger = logging.getLogger(__name__)

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})


@app.route('/parse_route', methods=['POST'])
def parse_route():
    options = json.loads(request.form['options'])
    logger.info('Options: {}'.format(options))

    file_content = request.form['file_content']

    try:
        if 'file_type' not in options or options['file_type'] is None:
            raise Exception('No file ending provided.')

        if file_content is None:
            raise Exception('No GPX/KML file provided with the POST request.')

        geo_file_parser = GeoFileParser(fetch_elevation=False)
        path = geo_file_parser.parse(file_content=file_content, extension=options['file_type'])

        equidistant_transformer = EquidistantTransformer(equidistant_distance=10)
        path = equidistant_transformer.transform(path)

        route = path.to_polyline() if 'encoding' in options and options['encoding'] == 'polyline' else path.to_json()
        result_json = {
            'status': GeneratorStatus.SUCCESS,
            'route': route,
        }

        if path.has_elevation_for_all_points():
            result_json['elevation_data'] = path.to_elevation_polyline()

        return app.response_class(response=json.dumps(result_json), status=200, mimetype='application/json')

    except Exception as e:

        logger.error('Exception while parsing file: {}'.format(e))

        return app.response_class(
            response=json.dumps({'status': GeneratorStatus.ERROR, 'message': str(e)}),
            status=500, mimetype='application/json')


@app.route('/create-walk-time-table', methods=['POST'])
def create_walk_time_table():
    if request.is_json:
        options = request.get_json()
    elif 'options' in request.form:
        options = json.loads(request.form['options'])
    else:
        return app.response_class(
            response=json.dumps({'status': GeneratorStatus.ERROR, 'message': 'Invalid request format.'}),
            status=500, mimetype='application/json')

    # Decode options['route'] form polyline
    if 'encoding' in options and options['encoding'] == 'polyline':

        path = Path(list(map(lambda pkt: Point_LV95(lat=pkt[0], lon=pkt[1]), polyline.decode(options['route'], 0))))

        if 'elevation_data' in options:

            elevation_data = polyline.decode(options['elevation_data'], 0)
            for i, way_point in enumerate(path.way_points):
                way_point.point.h = elevation_data[i][1]

        else:
            height_fetcher_transformer = HeightFetcherTransformer()
            path = height_fetcher_transformer.transform(path)

        pois_str: str = ""
        if 'pois' in options:
            pois_str = options['pois']

        # calc POIs for the path
        pois_transformer = POIsTransformer(pois_list_as_str=pois_str)
        pois: Path = pois_transformer.transform(path)

        logger.info('Pois: {}'.format(pois))

        douglas_peucker_transformer = DouglasPeuckerTransformer(number_of_waypoints=21, pois=pois)
        selected_way_points = douglas_peucker_transformer.transform(path)

        result_json = {
            'status': GeneratorStatus.SUCCESS,
            'path': path.to_polyline(),
            'path_elevation': path.to_elevation_polyline(),
            'selected_way_points': selected_way_points.to_polyline(),
            'selected_way_points_elevation': selected_way_points.to_elevation_polyline(),
            'pois': pois.to_polyline(),
            'pois_elevation': pois.to_elevation_polyline(),
        }
        return app.response_class(response=json.dumps(result_json), status=200, mimetype='application/json')

    else:
        return app.response_class(
            response=json.dumps({'status': GeneratorStatus.ERROR, 'message': 'Invalid Encoding of route.'}),
            status=500, mimetype='application/json')

    return app.response_class(
        response=json.dumps({'status': GeneratorStatus.SUCCESS}),
        status=200, mimetype='application/json')


@app.route('/create', methods=['POST'])
def create_map():
    uuid = str(uuid_factory.uuid4().hex)
    logger.debug('New request to with create_map().', {'uuid': uuid})
    output_directory = 'output/' + uuid + '/'

    logger.log(ExportStateLogger.REQUESTABLE, 'Export wird vorbereitet.',
               {'uuid': uuid, 'status': GeneratorStatus.RUNNING})

    parser = get_parser()
    args_as_dict = request.args.to_dict(flat=True)
    args = list(functools.reduce(lambda x, y: x + y, args_as_dict.items()))
    args = list(filter(lambda x: x != '', args))
    args = parser.parse_args(['-fn', '', '--output_directory', output_directory, '--print-api-base-url',
                              os.environ['PRINT_API_BASE_URL']] + args)

    options = json.loads(request.form['options'])
    logger.info('Options: {}'.format(options))
    file_content = request.form['file_content']

    thread = Thread(target=create_export,
                    kwargs={'uuid': uuid, 'args': args, 'options': options, 'file_content': file_content})
    thread.start()

    # Send the download link to the user
    response = app.response_class(
        response=json.dumps({'status': GeneratorStatus.RUNNING, 'uuid': str(uuid)}),
        status=200, mimetype='application/json')

    return response


@app.route('/status/<uuid>')
def return_status(uuid):
    response = app.response_class(
        response=json.dumps(stateHandler.get_status(uuid)),
        status=200, mimetype='application/json')
    return response


@app.route('/download/<uuid>')
def request_zip(uuid):
    # Check if export is completed and still present in the 'output' folder
    base_path = pathlib.Path('./output/' + uuid + '/')
    state = stateHandler.get_status(uuid)

    if (state and state['status'] != GeneratorStatus.SUCCESS) or not os.path.exists(base_path):
        return "Die angefragten Daten sind nicht (mehr) verfügbar."

    # Return Zip with data
    data = io.BytesIO()
    with zipfile.ZipFile(data, mode='w') as z:
        for f_name in base_path.iterdir():
            # get only filename from f_name to write the file into the root of the zip
            only_name = str(f_name.name)
            z.write(f_name, only_name)
    data.seek(0)

    # delete and return files
    try:
        stateHandler.remove_status(uuid)
        shutil.rmtree(base_path)
    except OSError as e:
        logger.error("Cannot delete files in folder %s : %s" % (base_path, e.strerror))
    finally:
        return send_file(
            data,
            mimetype='application/zip',
            as_attachment=True,
            attachment_filename='Download.zip'
        )


def create_export(uuid: str, args: argparse.Namespace, options, file_content):
    logger.log(ExportStateLogger.REQUESTABLE, 'Der Export wurde gestartet.',
               {'uuid': uuid, 'status': GeneratorStatus.RUNNING})

    generator = None

    try:
        generator = AutomatedWalkTableGenerator(args, uuid, options, file_content)
        generator.run()

    finally:

        export_state = stateHandler.get_status(uuid)['status']

        if not generator or export_state == GeneratorStatus.RUNNING:
            logger.log(ExportStateLogger.REQUESTABLE,
                       'Der Export ist fehlgeschlagen. Ein unbekannter Fehler ist aufgetreten!',
                       {'uuid': uuid, 'status': GeneratorStatus.ERROR})


if __name__ == "__main__":
    app.run(debug=(os.environ.get("DEBUG", "False").lower() in ('true', '1', 't')), host="0.0.0.0",
            port=int(os.environ.get("PORT", 5000)), )
