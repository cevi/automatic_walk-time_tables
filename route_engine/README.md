# Query a Path

```bash
curl -s -XPOST 'http://localhost:8002/route' -H'Content-Type: application/json' --data-raw '{"locations": [{"lat": 47.32214, "lon":  8.47885}, {"lat": 47.31875, "lon": 8.48224}], "costing": "pedestrian"}'
```

# Create OSM.PBF file

The route generator needs an `.osm.pbf` file to work. You can create such a file directly from source (i.g. from the raw
SHP files, which can be downloaded from swisstopo). The following command creates an  `.osm.pbf` file from the raw SHP
files.

**Note:** You need roughly 32GB of memory on your machine to run this script.

You can download the SHP files from https://www.swisstopo.admin.ch/de/landschaftsmodell-swisstlm3d.

```bash
# First you need to build the docker container in the `helper_scripts` folder.
docker build -t shp_to_osm .

# Now you can convert the SHP files to OSM.PBF using:
docker run -v /path/to/shp/files:/data shp_to_osm
```
