# Application Structure

## Frontend/Webinterface

::: info
Source in `./frontend` folder.
:::

A simple angular application served as a webpage. It allows for users to call the automatic walk-time generator with
a graphical user interface.

More info can be found here: [Frontend/Webinterface](../frontend/about.md).

## Backend & API

::: info
Source in `./backend` folder.
:::

The backend is used by the web interface, it's an API wrapping a python script, which generates the walk-time table form
a GPX- or KML-file. There exists both endpoints for fully automated and for interactive generation of the walk-time
table.

More info can be found here: [Backend](../backend/about.md).

## Tile Cache

::: info
Source in `./tile_caching` folder.
:::

We use a simple nginx proxy to cache the fetched map tiles. This speeds up the printing time of the MapFish print
service. For that nginx is configured to cache the JPEG images (tiles) retrieved from the swisstopo servers.

## MapFish Print Server

::: info
Source in `./mapfish_print_server` folder.
:::

We use MapFish 3 with a custom template to create PDF reports containing maps, i.g. the PDF files containing the map of
the route are created by this service. MapFish 3 is open source, see https://github.com/mapfish/mapfish-print.

More info can be found here: [MapFish Print Server](../mapfish_print_server/about.md).

## Swiss TLM API

::: info
Source in `./swiss_TLM_api` folder.
:::

More info can be found here: [Swiss TLM API](../swiss_TLM_api/about.md).

## Routing Engine

::: info
Source in `./routing_engine` folder.
:::

More info can be found here: [Routing Engine](../routing_engine/about.md).

## Documentation

::: info
Source in `./docs` folder.
:::

More info can be found here: [Documentation](../documentation/about.md).
