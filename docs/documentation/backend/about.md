# Backend & API

This is the main component of the application, a wrapper around the `automatic_walk_time_tables` module. This module can convert a provided route file (e.g. a GPX- or KML-file) into a walk-time table as used by Jugend+Sport. The wrapper is run inside a docker container.

## Run the Wrapper as a Web-API using Docker

We are using a flask server to expose the python3 module as API endpoints. You can start the server with the following
commands. Once executed, the API can be accessed at <a href="http://localhost:5000/" target="_blank" rel="noreferrer">localhost:5000</a>.

```bash
$ docker build . -t cevi/walktable_backend:latest
$ docker run --publish=5000:5000  cevi/walktable_backend:latest
```

The full documentation of the API endpoints can be found here: [API Endpoints](./API_endpoints.md).

It requires the other containers to be also available and running.

## About swisstopo Services

This script highly depends on the services from swisstopo (Federal Office of Topography swisstopo). Those services are
free-of-charge and do not require registration (since 01.03.2021). However, you should follow there "Fair Use" rules.
More details see [API Documentation](https://api3.geo.admin.ch/services/sdiservices.html)
and [Terms of Use](https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html).