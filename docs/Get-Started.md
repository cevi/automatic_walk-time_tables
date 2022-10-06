# Get Started

As of version 2.0.0, the application is split into multiple parts, each living in its separate docker container. You
can launch the application as a bundle using the following command (Note: For all commands in the documentation, we are
assuming you're running Linux).

Docker Compose is used to launch the application. The following command will launch the application stack:

```bash
$ docker-compose up [--build]
```

*Note:* `--build` is optional and forces docker to rebuild the containers.

## Environments

The application can be run in different environments, each with its own purpose. Environments may influence the behaviour
of the application. An incomplete list of affected parts consists of the following:

- the logging level
- the port and domain the application uses to call the backend
- the build mode and compression of the Angular frontend

The following table lists all environments and their purpose.

| Environment | Purpose                                                                                            | Default Domain Binding |
|-------------|----------------------------------------------------------------------------------------------------|------------------------|
| `prod`      | Production environment, as hosted on [map.cevi.tool](https://map.cevi.tool).                       | `map.cevi.tool`        |
| `dev`       | Development environment                                                                            | `localhost`            |
| `dev-live`  | Development environment with enabled live reloading/rebuilding usefully to develop the application | `localhost`            |

To specify an environment, you can extend the docker-compose command with the `-f` flag, specifying an additional
docker-compose file. For example, to launch the `dev-live` environment, you can use the following command:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev-live.yml up [--build]
```

### Domain Binding - Running on Localhost

Depending on the environment, you must set the environment variable `DOMAIN` to `localhost` if you want to run the
application on your local machine. Setting the environment variable `DOMAIN` to `localhost` will cause the application
to bind to `localhost` instead of the default domain binding listed above.

Alternatively, you can force the application to bind to a specific domain by setting the environment variable `DOMAIN`
to the domain, you want to bind to. This is useful if you want to run the application on a different domain than the
default domain binding. E.g. used to host the dev branch in `prod` mode on `dev.map.cevi.tool`.

For the `prod` environment running on localhost, you can use the following command:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml -e DOMAIN=localhost up [--build]
```

## Application Structure

### Frontend / Webinterface

*Source in `./webinterface`*

A simple angular application served as a webpage. It allows for users to call the automatic walk-time generator with
a graphical user interface. More info can be found here: [Webinterface](webinterface/README.md).

### Backend

*Source in `./python_program`*

The backend is used by the web interface, it's an API wrapping a python script, which generates the walk-time table form
a GPX- or KML-file. More info can be found here: [Automatic Walk-Time Generator](python_program/Readme.md). The
documentation
of the API can be found here: [API Endpoints](python_program/API_Endpoints.md).

### MapFish PDF Creator

*Source in `./pdf_map_export`*

We use MapFish 3 with a custom template to create PDF reports containing maps, i.g. the PDF files containing the map of
the route are created by this service. MapFish 3 is open source, see https://github.com/mapfish/mapfish-print.

See [Setup MapFish Container](pdf_map_export/README.md) for instructions on how to set up our custom MapFish server.

TODO: Add others!