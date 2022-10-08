# Application Structure

## Frontend / Webinterface

*Source in `./webinterface`*

A simple angular application served as a webpage. It allows for users to call the automatic walk-time generator with
a graphical user interface.

More info can be found here: [Webinterface](../webinterface/about.md)

## Backend & API

*Source in `./python_program`*

The backend is used by the web interface, it's an API wrapping a python script, which generates the walk-time table form
a GPX- or KML-file.

More info can be found here: [Backend](../backend/about.md)

## MapFish PDF Creator

*Source in `./pdf_map_export`*

We use MapFish 3 with a custom template to create PDF reports containing maps, i.g. the PDF files containing the map of
the route are created by this service. MapFish 3 is open source, see https://github.com/mapfish/mapfish-print.

More info can be found here: [MapFish PDF Creator](../pdf_creator/about.md)


## Swiss TLM API

More info can be found here: [Swiss TLM API](../swiss_TLM_API/about.md)

## Route Server

More info can be found here: [Route Server](../route_server/about.md)