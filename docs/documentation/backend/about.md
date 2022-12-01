# Backend & API

This is the main component of the application, a wrapper around the `automatic_walk_time_tables` module. Which is a
custom python module, that can convert a provided route file (e.g. a GPX- or KML-file) into a walk-time table as used by
Jugend+Sport. The wrapper can be run in two configurations:

* as a web-API inside a docker container using flask,
* or as a standalone python3 script locally on your computer.

## Run the Wrapper as a Web-API using Docker

We are using a flask server to expose the python3 module as API endpoints. You can start the server with the following
commands. Once executed, the API can be accessed over http://localhost:5000/.

```bash
$ docker build . -t cevi/walktable_backend:latest
$ docker run --publish=5000:5000  cevi/walktable_backend:latest
```

The full documentation of the API endpoints can be found here: [API Endpoints](API_Endpoints.md).

## Run it locally using Python3

::: warning
This is not recommended, as this way of running the application is no longer maintained. We are using docker and the
flask API to communicate with the backend.
:::

### Prerequisites

1) Make sure you have installed python3 and all requirements listed in
   the `./automatic_walk_time_tables/requirements.txt` file. You can use the following command to install the
   dependencies:

   ```bash
   $ pip3 install -r ./automatic_walk_time_tables/requirements.txt
   ```

2) In order to create PDF-map exports, you need to set up a docker container. Please follow
   the [instructions](mapfish_print_server/README.md) inside the `../mapfish_print_server` folder. You can disable the
   PDF export
   feature with the `--create-map-pdfs False` argument,
   see [Command Line Arguments](docs/documentation/backend/command_line_arguments.md) for further details.

### Launch the script

You can launch the script as a standalone python3 application by calling:

```bash
$ python3 main.py --file-name <file_name>
```

Where the `file-name` flag specifies the path to your route file (GPX- or KML-file). Once the script has terminated, the
produced files (Excel, PDFs...) are stored in the directory specified with the argument `--output_directory`; default
is `./output/`. A full documentation of all command line arguments can be found
here: [Command Line Arguments](docs/documentation/backend/command_line_arguments.md).

## Test and Debug Tools

Make sure that your system fulfills the prerequisites as described in the section above, i.e. you should be able to run
the `automatic_walk_time_tables` script locally using python3.

## About swisstopo Services

This script highly depends on the services from swisstopo (Federal Office of Topography swisstopo). Those services are
free-of-charge and do not require registration (since 01.03.2021). However, you should follow there "Fair Use" rules.
More details see [API Documentation](https://api3.geo.admin.ch/services/sdiservices.html)
and [Terms of Use](https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html).