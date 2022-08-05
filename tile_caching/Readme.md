# Simple Local Tile Cache

This is a simple tile cache using an nginx proxy to serve tiles from a local directory or fetch them from a
remote server.

## For the Future...

Possible configuration for Mapproxy instance. Should be saved in a file called `mapproxy.yml`.

```yml

global:
  concurrent_tile_creators: 20

# Defines the service endpoint, i.g. the endpoint which get called to fetch a map tile
services:
  wmts:
    restful: true
    kvp: true
    restful_template: /1.0.0/{Layer}/default/{TileMatrixSet}/2056/{TileMatrix}/{TileCol}/{TileRow}.{Format}

sources:
  ch_swisstopo_swissimage:
    type: tile
    grid: current
    url: https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/2056/%(z)s/%(x)s/%(y)s.%(format)s


  ch_swisstopo_pixelkarte-farbe:
    type: tile
    grid: current
    url: https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/%(z)s/%(x)s/%(y)s.%(format)s


layers:
  - name: ch.swisstopo.swissimage-product
    title: ch.swisstopo.swissimage-product
    sources: [ ch_swisstopo_swissimage_cache ]

  - name: ch.swisstopo.pixelkarte-farbe
    title: ch.swisstopo.pixelkarte-farbe
    sources: [ ch_swisstopo_pixelkarte-farbe_cache ]

caches:
  ch_swisstopo_swissimage_cache:
    sources: [ ch_swisstopo_swissimage ]
    grids: [ current ]
    bulk_meta_tiles: true
    format: image/jpeg

  ch_swisstopo_pixelkarte-farbe_cache:
    sources: [ ch_swisstopo_pixelkarte-farbe ]
    grids: [ current ]
    bulk_meta_tiles: true
    format: image/jpeg

grids:
  current:
    srs: 'EPSG:2056'
    bbox: [ 2420000.0, 1030000.0, 2900000.0, 1350000.0 ]
    bbox_srs: 'EPSG:2056'
    origin: nw
    res: [ 4000,3750,3500,3250,3000,2750,2500,2250,2000,1750,1500,1250,1000,750,650,500,250,100,50,20,10,5,2.5,2,1.5,1,0.5,0.25,0.1 ]

```

```Dockerfile

FROM pdok/mapproxy-nginx

# copy config file
COPY mapproxy.yaml /usr/local/mapproxy/mapproxy.yaml


```