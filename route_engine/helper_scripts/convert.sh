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
# use ogr2osm to convert the *.shp to *.osm
for f in $(find /data/*.shp -type f); do
    out_f=${f%.shp}.osm
    ogr2osm -t /converter.py -o $out_f $f
done

timestamp=$(date +%Y-%m-%dT%H:%M:%S)

# replace "<node" with '<node user=""'
sed -i 's/<node/<node version="1" timestamp="2022-08-13T03:36:00Z"/g' /data/*.osm
sed -i 's/<way/<way version="1" timestamp="2022-08-13T03:36:00Z"/g' /data/*.osm

sed -i 's/id="-/id="/g' /data/*.osm
sed -i 's/ref="-/ref="/g' /data/*.osm

# use osmosis to convert the *.osm to *.osm.pbf
for f in $(find /data/*.osm -type f); do
    out_f=${f%.osm}.osm.pbf
    osmosis --read-xml $f --write-pbf $out_f
done

exec "$@"
