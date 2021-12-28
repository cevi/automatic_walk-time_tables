# Get Started

As of version 2.0.0, the application is split into three main parts, each living in its separate docker container. You
can launch the application as a bundle, using the following command (Note: For all commands in the documentation, we are
assuming you're running Linux or using the Windows Subsystem for Linux (WSL)).

This will launch all parts of the application, especially the frontend accessible at [localhost](http://localhost):

```bash
$ docker-compose up [--build]
```

*Note:* `--build` is optional and forces docker to rebuild the containers.

### Productive Hosting

Adding the environment file `prod.env` will build the docker containers for a productive environment.

```bash
$ docker-compose --env-file prod.env up --build
```

Production builds will use the production URLs instead of localhost. Production URLs are defined in config files:
- for the angular webinterface: in `./webinterface/src/environments`
- for the flask server directly in `./python_program/Dockerfile`

## Frontend / Webinterface

*Source in `./webinterface`*

A simple angular application served as a webpage. It allows for end user to call the automatic walk-time generator with
a graphical user interface. More info can be found here: [Webinterface](webinterface/README.md).

## Backend

*Source in `./python_program`*

The backend is used by the webinterface, it's an API wrapping a python script, which generates the walk-time table form
an GPX file. More info can be found here: [Automatic Walk-Time Generator](python_program/Readme.md). The documentation
of the API can be found here: [API Endpoints](python_program/API_Endpoints.md).

## MapFish PDF Creator

*Source in `./pdf_map_export`*

We use MapFish 3 with a custom template to create PDF reports containing maps, i.g. the PDF files containing the map of
the route are created by this service. MapFish 3 is open source, see https://github.com/mapfish/mapfish-print.

See [Setup MapFish Container](pdf_map_export/README.md) for instructions how to set up our custom MapFish server. 


