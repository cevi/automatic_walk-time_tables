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

from flask import Flask, request, send_file
from flask_cors import CORS

from automatic_walk_time_tables.arg_parser import get_parser
from automatic_walk_time_tables.generator_status import GeneratorStatus
from server_logging.log_helper import setup_recursive_logger
from server_logging.status_handler import ExportStateHandler, ExportStateLogger

stateHandler = ExportStateHandler()
stateLogger = ExportStateLogger(stateHandler)
setup_recursive_logger(logging.INFO, stateLogger)

from automatic_walk_time_tables.generator import AutomatedWalkTableGenerator

logger = logging.getLogger(__name__)

app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})


def create_export(uuid: str, args: argparse.Namespace):
    logger.log(ExportStateLogger.REQUESTABLE, 'Der Export wurde gestartet.',
               {'uuid': uuid, 'status': GeneratorStatus.RUNNING})

    generator = None

    try:
        generator = AutomatedWalkTableGenerator(args, uuid)
        generator.run()

    finally:

        export_state = stateHandler.get_status(uuid)['status']

        if not generator or export_state == GeneratorStatus.RUNNING:
            logger.log(ExportStateLogger.REQUESTABLE,
                       'Der Export ist fehlgeschlagen. Ein unbekannter Fehler ist aufgetreten!',
                       {'uuid': uuid, 'status': GeneratorStatus.ERROR})

        # Remove uploaded file from upload directory
        os.remove(args.file_name)
        os.rmdir('./input/' + uuid)


def get_file_ending(filename):
    return filename.rsplit('.', 1).pop().lower()


def allowed_file(filename):
    if '.' not in filename:
        return False

    return get_file_ending(filename) in ('gpx', 'kml')


@app.route('/create', methods=['POST'])
def create_map():
    uuid = str(uuid_factory.uuid4().hex)
    logger.debug('New request to with create_map().', {'uuid': uuid})

    # check if output and input folders exist, if not, create them
    input_directory = 'input/' + uuid + '/'
    output_directory = 'output/' + uuid + '/'
    pathlib.Path(input_directory).mkdir(parents=True, exist_ok=True)

    if 'file' not in request.files:
        logger.error('No GPX/KML file provided with the POST request.'.format(uuid), {'uuid': uuid})

        response = app.response_class(
            response=json.dumps({'status': 'error', 'message': 'No file submitted.'}),
            status=500, mimetype='application/json')
        return response

    file = request.files['file']

    # Check if a valid file is provided
    if not file or not allowed_file(file.filename):
        logger.error('Invalid file extension in filename \"{}\".'.format(file.filename), {'uuid': uuid})
        response = app.response_class(
            response=json.dumps({'status': 'error', 'message': 'Your file is not valid.'}),
            status=500, mimetype='application/json')
        return response

    file_ending = get_file_ending(file.filename)
    file_name = './input/' + uuid + '/upload.' + file_ending
    file.save(file_name)

    logger.log(ExportStateLogger.REQUESTABLE, 'Export wird vorbereitet.',
               {'uuid': uuid, 'status': GeneratorStatus.RUNNING})

    parser = get_parser()
    args_as_dict = request.args.to_dict(flat=True)
    args = list(functools.reduce(lambda x, y: x + y, args_as_dict.items()))
    args = list(filter(lambda x: x != '', args))
    args = parser.parse_args(['-fn', file_name, '--output_directory', output_directory, '--print-api-base-url',
                              os.environ['PRINT_API_BASE_URL']] + args)

    thread = Thread(target=create_export, kwargs={'uuid': uuid, 'args': args})
    thread.start()

    # Send the download link to the user
    response = app.response_class(
        response=json.dumps({'status': 'submitted', 'uuid': str(uuid)}),
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

    if (state and state['status'] != 'finished') or not os.path.exists(base_path):
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


if __name__ == "__main__":
    app.run(debug=(os.environ.get("DEBUG", "False").lower() in ('true', '1', 't')), host="0.0.0.0",
            port=int(os.environ.get("PORT", 8080)))
