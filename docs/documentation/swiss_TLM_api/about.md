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
over <a href="http://localhost:5000/" target="_blank" rel="noreferrer">localhost:5000</a>.

```bash
docker build . -t cevi/swiss_tlm_api:latest
docker run --publish=1848:1848 --mount type=bind,source="$(pwd)"/resources,target=/app/resources \
             --mount type=bind,source="$(pwd)"/index_cache,target=/app/index_cache \
             cevi/swiss_tlm_api:latest
```

## Data Sources and Automated Downloads

Make sure you have an internet connection during the first container boot or execution. The application relies heavily on massive offline datasets from Swisstopo:

### 1. Spatial KD-Tree Index (Pre-compiled)

Processing Swisstopo's massive datasets into a high-performance memory-mapped KD-Tree locally takes quite a while. To prevent this slow process on boot in Production environments, a robust pre-compiled `index_cache.tar.xz` snapshot is downloaded dynamically from Google Drive.

- **Cache Invalidation:** `name_index.py` keeps the version of the downloaded index in `index_cache/.version` and
  downloads the archive again when `INDEX_CACHE_VERSION` changes. To publish a new index:
  1. Build it: run `python scripts/fetch_hoehenpunkte.py` (spot heights), then
     `NameIndex(force_rebuild=True, reduced=False)` in the swiss_TLM_api image with `resources/` and `index_cache/`
     mounted. The builders log errors and continue, so check the log for `ERROR`, for "Inserted ... named
     buildings" (about 3,500) and for "Added ... settlements and ... small lakes".
  2. Pack `swissname_data_index.dat`, `swissname_data_index.idx` and `.version` at the top level of
     `index_cache.tar.xz` (no folder).
  3. Upload it to Google Drive (shared drive, "Anyone with the link: Viewer"): either as a new version of the
     existing file (the ID stays) or as a new file, then set `file_id` in `name_index.py`.
  4. Bump `INDEX_CACHE_VERSION` in `name_index.py`; each server downloads the new index on its next start.

  Do not start the service on a freshly built `index_cache/` without a matching `.version`: it treats the build as
  outdated, deletes it and downloads the published index.

### 2. "Höhenpunkte"

As of the modern swisstopo 3D dataset (2024), pure numeric spot elevations (`TLM_KOTIERTER_PUNKT`) were explicitly removed from `swissNAMES3D` and split off into massive regional graphic raster layers in the Swiss Map Vector 25 (SMV25) databases.

To bypass maintaining 100GB+ of 200 raw tile databases, we introduced a fully async crawler trick:

- **`scripts/fetch_hoehenpunkte.py`**: Instead of committing huge datasets, this dedicated scraper directly interrogates the Swisstopo STAC API for the `swiss-map-vector25` collection, parses exclusively for `DKM25_HOEHENKOTE` numeric geometries directly out of `.gdb.zip`, and extracts an aggregated pinpoint Shapefile into `./resources/swissNAMES3D_data/SMV25_HOEHENKOTEN.shp`.
- This script produces a highly compressed 4MB overlay shapefile containing ~1.5 million anonymous terrain peaks.
- **Naming Logic**: At runtime inside `app.py`, these raw numeric markers are processed as `"Kotierter Punkt"`, and dynamically search within ~250m for proximate localized fields (e.g. `Flurname` or `Lokalname` records from `swissNAMES3D`), synthesizing them into human-readable outputs like `"Punkt 1555 (Wannen)"`.

### 3. Native Boot Loader Logic

If running locally via `force_rebuild=True`:

1. `name_index.py` detects missing SHP resources and downloads the raw `swissTLM3D` architecture datasets seamlessly.
2. It parses across the `SMV25_HOEHENKOTEN.shp` generated by the crawler alongside the natively named peaks.
3. The RTree parses millions of shapes, writes `.dat` mapping databases to the local disk, and spins up the Flask querying framework over Port 1848.

### Environment Dependencies

1. **System Packages**: Ensure `libspatialindex-dev` is installed for native RTree indexing:
   ```bash
   $ sudo apt-y install libspatialindex-dev
   ```
