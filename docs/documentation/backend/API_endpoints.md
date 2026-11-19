# API Documentation

## /health [GET]

Returns `{"status": "ok"}` as soon as the backend serves requests. Used by the docker `HEALTHCHECK` of the backend
container.

## /parse_route [POST]

Parses a GeoFile and returns a JSON containing the route.

The post request must be of type `multipart/form-data` and contain the following fields:

- `options`: JSON containing the options for the route parser.
- `file_content`: The content as string of the file to parse.

Returns a JSON with the following fields:

- `status`: The status of the file parsing (`error` or `success`)
- `route`: (encoded polyline representation of the) path in LV95 coordinates

Options are:

- `encoding`: The encoding of the returned route. Possible values are,
  if or any other values is passed, the result will be returned as a JSON
    - `polyline`: Encoded polyline representation of the path
- `file_type`: The type of the file to parse. Possible values are:
    - `gpx`: for GPX file
    - `kml`: for KML file

::: warning
For KML files, this endpoint is very slow, as the elevation data has to be fetched fron swisstopo. For GPX files, the
elevation data is already included in the file.
:::

### Example

with config JSON

```json
{
  "encoding": "polyline",
  "file_type": "kml"
}
```

and KML file

```xml

<kml>
    <Document>
        <Placemark>
            <ExtendedData>
                <Data name="type">
                    <value>linepolygon</value>
                </Data>
            </ExtendedData>
            <LineString>
                <coordinates>
                    8.618027327171838,47.33919699571174
                    8.651468773480518,47.32415372661812
                </coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>
```

Request:

```bash
curl 'http://localhost:5000/parse_route' \
  -H 'Accept: application/json' \
  -H 'Content-Type: multipart/form-data; boundary=----WebKitFormBoundary' \
  --data-raw $'------WebKitFormBoundary\r\nContent-Disposition: form-data; name="options"\r\n\r\n{"encoding":"polyline","file_type":"kml"}\r\n------WebKitFormBoundary\r\nContent-Disposition: form-data; name="file_content"\r\n\r\n<kml><Document><Placemark><ExtendedData><Data name="type"><value>linepolygon</value></Data></ExtendedData><LineString><coordinates>8.618027327171838,47.33919699571174 8.651468773480518,47.32415372661812</coordinates></LineString></Placemark></Document></kml>\r\n------WebKitFormBoundary--\r\n'
```

Response:

```json
{
  "status": "success",
  "route": "...",
  "elevation_data": "...",
  "route_name": "..."
}
```

## Way points

The frontend has two modes for the way points of the walk-time table, each with its own endpoint. Both take the route
as JSON and return named way points.

The route is passed as

- `route`: encoded polyline (precision 0) of the LV95 coordinates of the route
- `elevation` (optional): encoded polyline (precision 0) of `[accumulated distance in m, height]` for every point of
  the route; fetched from swisstopo if missing

and every returned way point is a point of the route:

```json
{
  "x": 2644311,
  "y": 1136160,
  "h": 2075,
  "accumulated_distance": 0,
  "name": "Weggabelung bei Nessel",
  "name_type": "Weggabelung",
  "landmark": {
    "score": 60,
    "types": ["Weggabelung"],
    "reasons": ["Weggabelung"]
  }
}
```

`landmark` is `null` if there is nothing recognisable at the way point (see below). `name` is empty if nothing named
is close enough (see the naming service, `/names`). Two different places of a route get different names: the second
one gets the next best name of the naming service, or its height if there is none ("Weggabelung bei X (812)").

### /waypoints/auto [POST]

Automatic mode: selects up to 21 way points for the route.

The selection represents the elevation profile (start, end, highest and lowest point, changes of gradient) and prefers
landmarks: places that can be recognised when walking past them or that are printed on the 1:25'000 map, e.g.
junctions, bridges, stops, summits and spot heights. A landmark counts as deviating up to 20 m more from the profile
than a point where there is nothing to see. No stretch of the route is longer than 1.5 km without a way point, and
of two way points closer than 200 m (with less than 30 m height difference) only the more important one is kept.

```json
{
  "route": "...",
  "elevation": "...",
  "fixed_distances": [0, 1352]
}
```

`fixed_distances` (optional) are accumulated distances [m] of way points that must be kept, in addition to the start,
the end and the highest and lowest point.

Response:

```json
{
  "status": "success",
  "waypoints": [{...}, ...]
}
```

Without `elevation` in the request, the backend fetches the profile from geo.admin.ch and also returns `route` and
`elevation`; send them with the next request for the same route to skip the lookup. If geo.admin.ch is unavailable,
the response is 503 with a `Retry-After` header.

### /waypoints/manual [POST]

Manual mode: puts way points chosen by the user onto the route, exactly where the user put them, and names them.
A way point at a landmark is named after it, as in the automatic mode.

```json
{
  "route": "...",
  "elevation": "...",
  "waypoints": [{"accumulated_distance": 2486}, {"x": 2645830, "y": 1137370}],
  "include_start_end": false
}
```

- `waypoints`: positions given as accumulated distance [m] or LV95 coordinates; each is placed on the nearest point
  of the route
- `include_start_end` (optional, default false): also returns the start and end of the route if no way point is
  there, e.g. after the route was changed. Without way points, it returns the start, the highest and lowest point and
  the end.

The response has the same format as `/waypoints/auto`, with the way points in the order of the request.

### /names [POST]

Names for LV95 coordinates.

```json
{
  "points": [[2633700, 1252830]]
}
```

Response:

```json
{
  "status": "success",
  "names": [{"name": "Cholholz", "object_type": "Ort", "offset": 75}]
}
```

`name` is empty if nothing named is close enough. At most 500 points per request.

### Deprecated: /create-walk-time-table [POST] and /get_name [POST]

Replaced by `/waypoints/auto`, `/waypoints/manual` and `/names`. They are kept for one release for frontends that were
loaded before the update.

## /create_map [POST]

Triggers the export of the walk-time-table.

The settings/flags are the same as for the command line version (see [here](./command_line_arguments.md)) but should be
passed as JSON without a leading `-` resp. `--`. See example below.

::: info
Contrary to the command line version, the argument `--file-name` is neither required nor supported. Use `route-name`
instead to specify the name of the route.
:::

```json
{
  "settings": {
    "velocity": 4.5,
    "map-scaling": 25000,
    "departure-time": "2022-08-04T20:00",
    "creator-name": "",
    "create-map-pdfs": true,
    "create-excel": true,
    "legend-position": "lower right",
    "map-layers": "ch.swisstopo.pixelkarte-farbe",
    "auto-scale": false,
    "route-name": "My Route",
    "name-points-in-export": true
  },
  "flags": [],
  "encoding": "polyline",
  "route": "...",
  "route_elevation": "...",
  "way_points": "...",
  "way_points_elevation": "...",
  "pois_distance": "0, 0, 1352, 3031"
}
```

### Example

Request

```bash
curl 'http://localhost:5000/create_map' \
  -H 'Accept: application/json' \
  -H 'Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryb5779mtysvzw8Rej' \
  --data-raw $'------WebKitFormBoundaryb5779mtysvzw8Rej\r\nContent-Disposition: form-data; name="options"\r\n\r\n{"settings":{"velocity":4.5,"map-scaling":25000,"departure-time":"2022-08-04T20:00","creator-name":"","create-map-pdfs":true,"create-excel":true,"legend-position":"lower right","map-layers":"ch.swisstopo.pixelkarte-farbe","auto-scale":false},"flags":[],"encoding":"polyline","route":"ueccDsi|jAOHULSJSLOHSLSJSLUJSLOHSJSLQHSLSJSLSJQJSJSJSLSJOJUJSLSJSLOHSLUJSJOJSJSLSJQJSJSLSJSLQHSJSLSJSLSJQJSJSLOHSJSLUJSLOHSLSJSLQHSLSJSJSLSJQJSJSLSJQJSJSLSJOHSLUJSLSJOJSJSLSJULSJOHSLSJQJSJSLSJOHULSJSLSJOJSJULSJSLSJOHSLUJOJSJSLSJSLQHSLSJSJQJSJSLSJSLSJSLQHSLSJOHSLSJULOHSLSJSLSJQHSLSJSLSJSLQHSLSJOJUJSJSLSJOJSJSLUJOJSJSLSJSJULSJOJSJQJSJSLSJSLOHUJSLSJSLOHSLUJSLSJSLOHSJSLQHSLSJSLQHSLSJSJSLOHULSJSLSJSLSJQJSJOHSLSJSLUJOJSJSLSJSLQHSJSLSJSLSJQJSJOJSJSJULSJOJSJSLSJULOHSLSJSJSLUJSLOHSLQHSLSJSLOHSJULSJSLOHSLSJSLUJSLSJOHSLQHSLSJSLSJQJSJSJSLSJA@","route_elevation":"?ag@S?W?W?W?S?WAW?W?W?W?S?W?WAS@WAWCW@W?S?W?WAWAW?S?WAW?W?WAS?WAWAWASAWCWAWAS?WAWAWAWAS@WEW?WAWAWASCW?WES?WCWAWAWAS?WAWCWAS?WAWAWAWAW?SAW?WAWAS?W?WAWASEWCW?WAWCSAWCWAWCWCWASCWEWCSAWAWAWCSAWCWCW?W?SGWAWCWAW@WCS?W?WCSAWAWAWAWASCWAWCW?SAW@WCW@W@W@W@S?W?W@SAWFWDW@S@W?WDW@W?SBW@W?W?WAW@S?W?WAS?WCWAW@WBS?WDW@WBSDWFWBWDWDW@WDS@W@S@W@W@W?W@SDWGWAW?WASAWAWCWCWCWAS?W?WAS?WAW?WAS?W?WAWAW?SAW?WAW?W?W?W?S?W@S?W@W@W@W@S@W@W@W?W?S?W@W?W?W@W?S@W?S@W?W@W?W@S?WBW@W@WBS@W?WFWFW@W?WDSCW?SAW@WAW?SNW?W?W?W?SDWDW@W@W@WCWES?W?S?W?W?W?W?SAWAW?WAW@A?","way_points":"ueccDsi|jA_SxK{\\\\bRkIrE}I~EoGlDgTrL_DdBkZnPaEzB{CbBc@VsDpBqGnD","way_points_elevation":"?ag@wVUob@cBgKu@_L_@cI^gXhA{DWo_@DgF^wD@k@NsEPeIM","pois_distance":"0,0,1352,3031"}\r\n------WebKitFormBoundaryb5779mtysvzw8Rej--\r\n' \
```

Response

```json
{
  "status": "running",
  "uuid": "..."
}
```

## /status/[uuid] [GET]

- Returns a JSON with the following fields:
    - `status`: `running`, `error`, `finished`
    - `message`: Message
    - `last_change`: Timestamp of the last change

If the status is `finished`, the file can be downloaded via the `/download/[uuid]` endpoint.

### Example

Request:

```bash
curl 'http://localhost:5000/status/0f8e0b0e-5c1f-4b1f-9b1f-5c1f4b1f9b1f' \
  -H 'Accept: application/json'
```

Response:

```json
{
  "status": "running",
  "message": "Route wurde berechnet.",
  "last_change": "20:47:08",
  "route": "...",
  "history": [
    {
      "status": "running",
      "message": "Export wird vorbereitet.",
      "last_change": "20:47:08",
      "route": {}
    }
  ]
}
```

## /download/[uuid] [GET]

Returns a ZIP folder containing the files created by the generator or a string with an error message.

### Example

Request:

```bash
curl 'http://localhost:5000/download/b291d4f28ced4128897cf6977505287e'
```