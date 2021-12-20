import functools
import io
import os
import pathlib
import zipfile

import flask
from flask import Flask, request, flash, redirect

from main import generate_automated_walk_table, create_arg_parser

app = Flask(__name__)

UPLOAD_FOLDER = '/testWalks'
ALLOWED_EXTENSIONS = set(['gpx'])


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/create', methods=['POST'])
def create_map():
    download_id = 'random-id'

    if 'file' not in request.files:
        flash('No file part')
        return redirect(request.url)

    file = request.files['file']

    file_name = 'testWalks/' + download_id + 'default_file.gpx'

    if file and allowed_file(file.filename):
        file.save(file_name)

    parser = create_arg_parser()

    args_as_dict = request.args.to_dict(flat=True)
    args = list(functools.reduce(lambda x, y: x + y, args_as_dict.items()))
    args = list(filter(lambda x: x != '', args))

    args = parser.parse_args(['-gfn', file_name] + args)
    generate_automated_walk_table(args)

    return "success"


@app.route('/download/<download_id>')
def request_zip(download_id):
    base_path = pathlib.Path('./output/')

    # Return Zip with data
    data = io.BytesIO()
    with zipfile.ZipFile(data, mode='w') as z:
        for f_name in base_path.iterdir():
            z.write(f_name)
    data.seek(0)

    return flask.send_file(
        data,
        mimetype='application/zip',
        as_attachment=True,
        attachment_filename='Download.zip'
    )


if __name__ == "__main__":
    app.run(debug=(os.environ.get("DEBUG", "False").lower() in ('true', '1', 't')), host="0.0.0.0",
            port=int(os.environ.get("PORT", 8080)))
