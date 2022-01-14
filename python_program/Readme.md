# Automatic Walk-Time Tables

This is the main component of the application. A script implemented in python which creates a walk-time table from a GPX
file. The script can be run in two configurations: as a web-API (for example inside a docker container), or as a standalone python3
script.

## Run it as a web-API using Docker

We are using a flask server to expose the python3 script as API endpoints. You can start the server with the following
commands. Once executed, the API can be accessed over http://localhost:5000/.

```bash
$ docker build . -t cevi/walktable_backend:latest
$ docker run --publish=5000:5000  cevi/walktable_backend:latest
```

The documentation of the API endpoints can be found here: [API Endpoints](API_Endpoints.md).

## Additional Settings

| Name                     | arguments | Description                                                     |
|--------------------------|-----------|-----------------------------------------------------------------|
| `-gfn` `--gpx-file-name` | `String`  | Name and path to the GPX file default value. Required Argument. |

### Optional Arguments

| Name                    | arguments     | Description                                                                                                                                                                                                                                                                                               |
|-------------------------|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `-v` `--velocity`       | `Float`       | Speed in km/h on which the calculation is based, default 3.75 km/h.                                                                                                                                                                                                                                       |
| `-s` `--map-scaling`    | `Integer`     | Scaling of the created map (e.g. 10000 for scaling of 1:10'000). If not specified, the scaling will be automatically chosen such that the path can be printed onto a single A4 paper. The scaling gets chosen out of a list of common map scaling: 1:10'000, 1:25'000, 1:50'000, 1:100'000, or 1:200'000. |
| `-t` `--departure-time` | ISO-timestamp | Departure date in ISO-format, i.g. 2011-11-04T00:05:23. Default 2021-08-16T09:00:00.                                                                                                                                                                                                                      |
| `-n` `--creator-name`   | `String`      | The name of the creator of this walk-table. Default is just an empty string.                                                                                                                                                                                                                              |
| `--log-level`           | `Integer`     | Log Level (see https://docs.python.org/3/library/logging.html#levels). Default: WARNING                                                                                                                                                                                                                   |
| `--output_directory`    | `String`      | Subdirectory in the output folder for storing the created files. Should be empty or ending with "/"                                                                                                                                                                                                       |
| `--print-api-base-url`  | `String`      | Base URL of the mapfish server used for creating PDF exports. Default: localhost.                                                                                                                                                                                                                         |

### Enable/Disable Features

| Name                         | arguments | Description                                                                                                                                                      |
|------------------------------|-----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--create-map-pdfs`          | Boolean   | Enable/Disable export as PDF. Require a running MapFish docker container. Enabled as default (True).                                                             |
| `--create-excel`             | Boolean   | Enable/Disable creation of the walk-time table as excel. Enabled as default (True).                                                                              |
| `--create-elevation-profile` | Boolean   | Enable/Disable creation of the elevation profile as PNG. Enabled as default (True).                                                                              |
| `--open-images`              | None      | If this flag is set, the created images will be shown (i.g. elevation plot will be opened after its creation). For this feature a desktop environment is needed. |

## Run it locally using python3

### Prerequisites

1) Make sure you have installed python 3 and all requirements listed in
   the `./automatic_walk_time_tables/requirements.txt` file. You can use the following command to install the
   dependencies:

   ```bash
   pip3 install -r ./automatic_walk_time_tables/requirements.txt
   ```

2) In order to create PDF-map exports, you need to set up a docker container. Please follow
   the [instructions](../pdf_map_export/README.md) inside the `../pdf_map_export` folder. You can disable the PDF export
   feature with the `--create-map-pdfs False` argument.

### Launch the script

You can launch the script by calling:

```bash
$ python3 main.py --gpx-file-name <file_name>
```

Where the `gpx-file-name` flag specifies the path to your GPX file. Once the script has terminated, the produced files (
Excel, PDFs...) are stored in the directory specified with the argument `--output_directory`; default is `./output/`. Note: the script is only tested with GPX-files exported form SchweizMobil and from the official swisstopo app, but it should work with arbitrary GPX-files.

## About swisstopo Services

This script highly depends on the services form swisstopo (Federal Office of Topography swisstopo). Those services are
free-of-charge and do not require registration (since 01.03.2021). However, we should follow there "Fair Use" rules.
More details see [API documentation](https://api3.geo.admin.ch/services/sdiservices.html)
and [Terms of use](https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html).

Thus, in some cases, e.g. finding a swisstopo name for a coordinate, we will not use the official API but rebuild the
query algorithm locally. Therefore, please make sure, you have downloaded the necessary files in the ./res folder. The
files needed include ```swissNAMES3D_LIN.csv```, ```swissNAMES3D_PKT.csv```, and ```swissNAMES3D_PLY.csv```.