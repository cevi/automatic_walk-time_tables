# API Documentation

## Endpoints

### /create [POST]

- Should contain the route file (GPX- or KML-file) as `file` in the request.
- Additional parameters (see [Command Line Arguments](automatic_walk_time_tables/Command_Line_Arguments.md) are accepted
  the same way as they are passed to the python script).
- Returns a JSON with the following fields:
    - `status`: `Laufend` or `Fehler`
    - `uuid`: uuid of the created walk-table (only if `status`=`Laufend`)
    - `message`: Error message (only if `status`=`Fehler`)

#### Example:

```
[HOST]/create?--velocity=4.5&--create-excel=false
```

Possible response:

```JSON
{
  "status": "submitted",
  "uuid": "[uuid]"
}
```

### /status/[uuid] [GET]

- Returns a JSON with the following fields:
    - `status`: `Laufend`, `Fehler`, `Fertig`
    - `message`: Message
    - `last_change`: Timestamp of the last change

If the status is `finished`, the file can be downloaded via the `/download/[uuid]` endpoint.

### /download/[uuid] [GET]

Returns a ZIP folder containing the files created by the generator or a string with an error message.

### /parse_route [GET]

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
