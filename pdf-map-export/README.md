# Lokal MapFish Export



## 1) Run docker:

`docker run  --name=mapfish-print-test  --mount type=bind,source=./pdf-map-export,target=/usr/local/tomcat/webapps/ROOT/print-apps/swisstopo  --publish=8080:8080  camptocamp/mapfish_print`



## 2) Open localhost:8080

Copy `query.json` to input field and print a PDF



## Some notes about the query

The query uses  "projection": "EPSG:2056", i.g. it uses the LV95 coordinate format. Do not modify the "matrices" attribute!

