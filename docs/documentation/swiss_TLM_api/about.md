# API for the Swiss Topographic Landscape Model (TLM)

The topographic landscape model is a database for three-dimensional geodata provided by Swisstopo. We use various parts
of their dataset during the calculation of the walk-time table, e.g. in the point selecting algorithm or during name
finding. All this data can be queried with an internal API specified in this docker container.

More information about the topographic landscape model can be found here:
[Federal Office of Topography](https://www.swisstopo.admin.ch/en/knowledge-facts/topographic-landscape-model.html).

## API Endpoints

A detailed description of the API endpoint can be found here: [API Endpoints](API_endpoints.md).

- swiss_name: find names for given points
- map_number: fetch the map numbers for a given path

**Future Endpoints**:

- route calculation, given two points, the API returns a list of points describing a route between the two.
- calc POIs for a given route, i.g. for a given route the API returns a list along the path with POIs. We understand
  PIOs as points with a special / precise naming, e.g. the peak of a mounten, a river crossing, a fire place, etc.
- API Endpoint to query street type: Wanderweg-Kategorie, Street Type and Belagtype

## Run the Wrapper as a Web-API using Docker

We are using a flask server to expose the python3 module as API endpoints. You can start the server with the following
commands. Once executed, the API can be accessed
over  <a href="http://localhost:5000/" target="_blank" rel="noreferrer">localhost:5000</a>.

```bash
docker build . -t cevi/swiss_tlm_api:latest
docker run --publish=1848:1848 --mount type=bind,source="$(pwd)"/resources,target=/app/resources \
             --mount type=bind,source="$(pwd)"/index_cache,target=/app/index_cache \
             cevi/swiss_tlm_api:latest 
```

## Prerequisites for Local Execution

Make sure to download the latest version of the topographic landscape model dataset here:
from https://www.swisstopo.admin.ch/de/geodata/landscape/tlm3d.html.

1) Install `libspatialindex` for robust spatial indexing methods. Using the command:
   ```bash
   $ apt -y install libspatialindex-dev
   ```

2) And store it in the directory `./res/swissTLM3D_1.9_LV95_LN02_shp3d/`. Currently, we only need the `.shp` files.
   ```bash
   $ wget https://cms.geo.admin.ch/Topo/swisstlm3d/LV95/swissTLM3D_1.9_LV95_LN02_shp3d.zip
   $ unzip swissTLM3D_LV95_data.zip 
   ```

