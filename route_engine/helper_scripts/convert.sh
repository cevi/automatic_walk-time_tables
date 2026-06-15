#!/bin/bash

# Check if the folder `/shp_data` exists
if [ ! -d "/data" ]; then
    echo "The folder `/data` does not exist"
    exit 1
fi

# remove all *.geojson files
rm -rf /data/*.geojson
rm -rf /data/*.osm
rm -rf /data/*.pbf

# split shp files into multiple files

# See https://github.com/roelderickx/ogr2osm
# use ogr2osm to convert the *.shp to natively built *.osm.pbf with required Valhalla attributes
for f in $(find /data/*.shp -type f); do
    out_f=${f%.shp}.osm.pbf
    echo "Processing $f directly to $out_f..."
    ogr2osm -t /converter.py --positive-id --add-version --add-timestamp --pbf -o $out_f $f
done

exec "$@"
