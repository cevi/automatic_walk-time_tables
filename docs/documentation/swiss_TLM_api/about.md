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

## Data Sources and Automated Downloads

Make sure you have an internet connection during the first container boot or execution. The application depends on two datasets from Swisstopo, which are **automatically downloaded** if they are not already present in your `./resources/` directory:

1. **swissTLM3D** (Topographic Landscape Model): Used for streets, forests, structures, etc.
   - Automatically downloaded from Swisstopo (February 2026 release) to `./resources/swissTLM3D_LV95_data_full/`.
2. **swissNAMES3D**: Used for topological elevation points (Peaks, Passes, Hills, Viewpoints).
   - *Architecture Note:* As of the 2024 update, Swisstopo removed the `TLM_KOTIERTER_PUNKT` (pure numeric spot heights) from `swissTLM3D` and moved purely cartographic spot heights to the Swiss Map Vector (`SMV`) databases. Because `SMV` is fragmented into ~250 regional tiles totaling >100GB, this API now seamlessly uses the lightweight `swissNAMES3D` dataset to reliably extract over 30,000 nationwide named elevation points instead.
   - Automatically downloaded to `./resources/swissNAMES3D_data/`.

1) **System Packages**: ensure `libspatialindex-dev` is installed for RTree indexing:
   ```bash
   $ sudo apt-y install libspatialindex-dev
   ```

2) **Local Data Handling**: The `name_index.py` boot script will check for the `.shp` files in `./resources/` during startup. If missing, it will fetch them automatically. No manual `wget` extraction is required anymore for repo cloning.

