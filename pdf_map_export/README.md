# PDF Export using MapFish 3

## Run MapFish inside a Local Docker Container:

MapFish is an open-source tool to create reports containing maps. This script uses MapFish to create the PDF-map
exports. We relay on the default `camptocamp/mapfish_print` docker container, which we customized by adding our own
```config.yaml``` and ```report.jrxml```.

Once you have Docker installed on your system, you can start the MapFish print server by calling:

```bash
$ docker build . -t cevi/walktable_mapfish:latest
$ docker run --publish=8080:8080  cevi/walktable_mapfish:latest
```

## Test your MapFish Instance

You can test if the container is running properly by opening [http://localhost:8080](http://localhost:8080/). Now you
can copy-past the content of the `test_query.json` file and click on `Create And Get Print`. If the test PDF gets
created properly, your installation was successfully.
