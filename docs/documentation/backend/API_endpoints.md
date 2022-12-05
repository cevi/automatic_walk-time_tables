# API Documentation

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

## /create-walk-time-table [POST]

Creates a walk walk-time-table for a given route, i.e. it calculates the POIs and optimal waypoints of the route.

```json
{
  "encoding": "polyline",
  "route": "...",
  "elevation_data": "...",
  "pois_distance": "0, 0, 1352, 1734, 3031"
}
```

### Example

Request

```bash
curl 'http://localhost:5000/create-walk-time-table' \
  -H 'Accept: application/json' \
  -H 'Content-Type: multipart/form-data; boundary=----WebKitFormBoundary' \
  --data-raw $'------WebKitFormBoundary\r\nContent-Disposition: form-data; name="options"\r\n\r\n{"encoding":"polyline","route":"ueccDsi|jAOHULSJSLOHSLSJSLUJSLOHSJSLQHSLSJSLSJQJSJSJSLSJOJUJSLSJSLOHSLUJSJOJSJSLSJQJSJSLSJSLQHSJSLSJSLSJQJSJSLOHSJSLUJSLOHSLSJSLQHSLSJSJSLSJQJSJSLSJQJSJSLSJOHSLUJSLSJOJSJSLSJULSJOHSLSJQJSJSLSJOHULSJSLSJOJSJULSJSLSJOHSLUJOJSJSLSJSLQHSLSJSJQJSJSLSJSLSJSLQHSLSJOHSLSJULOHSLSJSLSJQHSLSJSLSJSLQHSLSJOJUJSJSLSJOJSJSLUJOJSJSLSJSJULSJOJSJQJSJSLSJSLOHUJSLSJSLOHSLUJSLSJSLOHSJSLQHSLSJSLQHSLSJSJSLOHULSJSLSJSLSJQJSJOHSLSJSLUJOJSJSLSJSLQHSJSLSJSLSJQJSJOJSJSJULSJOJSJSLSJULOHSLSJSJSLUJSLOHSLQHSLSJSLOHSJULSJSLOHSLSJSLUJSLSJOHSLQHSLSJSLSJQJSJSJSLSJA@","elevation_data":"?ag@S?W?W?W?S?WAW?W?W?W?S?W?WAS@WAWCW@W?S?W?WAWAW?S?WAW?W?WAS?WAWAWASAWCWAWAS?WAWAWAWAS@WEW?WAWAWASCW?WES?WCWAWAWAS?WAWCWAS?WAWAWAWAW?SAW?WAWAS?W?WAWASEWCW?WAWCSAWCWAWCWCWASCWEWCSAWAWAWCSAWCWCW?W?SGWAWCWAW@WCS?W?WCSAWAWAWAWASCWAWCW?SAW@WCW@W@W@W@S?W?W@SAWFWDW@S@W?WDW@W?SBW@W?W?WAW@S?W?WAS?WCWAW@WBS?WDW@WBSDWFWBWDWDW@WDS@W@S@W@W@W?W@SDWGWAW?WASAWAWCWCWCWAS?W?WAS?WAW?WAS?W?WAWAW?SAW?WAW?W?W?W?S?W@S?W@W@W@W@S@W@W@W?W?S?W@W?W?W@W?S@W?S@W?W@W?W@S?WBW@W@WBS@W?WFWFW@W?WDSCW?SAW@WAW?SNW?W?W?W?SDWDW@W@W@WCWES?W?S?W?W?W?W?SAWAW?WAW@A?","pois_distance":"0, 0, 1352, 1734, 3031"}\r\n------WebKitFormBoundary--\r\n' \
```

Response

```json
{
  "status": "success",
  "selected_way_points": "...",
  "selected_way_points_elevation": "...",
  "pois": "...",
  "pois_elevation": "..."
}
```

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
    "route-name": "My Route"
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