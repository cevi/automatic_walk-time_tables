# Application Structure

## Frontend / Webinterface

::: info
Source in `./webinterface` folder.
:::

A simple angular application served as a webpage. It allows for users to call the automatic walk-time generator with
a graphical user interface.

More info can be found here: [Webinterface](../webinterface/about.md).

## Backend & API

::: info
Source in `./python_program` folder.
:::

The backend is used by the web interface, it's an API wrapping a python script, which generates the walk-time table form
a GPX- or KML-file.

More info can be found here: [Backend](../backend/about.md).

## MapFish PDF Creator

::: info
Source in `./pdf_map_export` folder.
:::

We use MapFish 3 with a custom template to create PDF reports containing maps, i.g. the PDF files containing the map of
the route are created by this service. MapFish 3 is open source, see https://github.com/mapfish/mapfish-print.

More info can be found here: [MapFish PDF Creator](../pdf_creator/about.md).


## Swiss TLM API

::: info
Source in `./swiss_TLM_api` folder.
:::

More info can be found here: [Swiss TLM API](../swiss_TLM_API/about.md).

## Route Server

::: info
Source in `./route_server` folder.
:::

More info can be found here: [Route Server](../route_server/about.md).

## Documentation

::: info
Source in `./docs` folder.
:::

More info can be found here: [Documentation](../documentation/about.md).
