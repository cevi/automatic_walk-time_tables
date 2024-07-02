FROM ubuntu:22.04

# install git
RUN apt-get update && apt-get install -y git  python3 python3-pip libgdal-dev

RUN export CPLUS_INCLUDE_PATH=/usr/include/gdal
RUN export C_INCLUDE_PATH=/usr/include/gdal

# install ogr2osm and ogr2ogr
RUN pip3 install gdal==$(gdal-config --version)
RUN pip3 install protobuf ogr2osm

RUN apt-get update && apt-get install -y gdal-bin osmctools osmosis

# Copy script
COPY convert.sh /convert.sh
COPY converter.py /converter.py
RUN chmod +x /convert.sh

# Execute the convert.sh script on startup
ENTRYPOINT ["/convert.sh"]

