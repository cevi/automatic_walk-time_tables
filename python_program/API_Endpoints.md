# API Documentation

## Endpoints

### /create [POST]

- Should contain the route file (GPX- or KML-file) as `file` in the request.
- Additional parameters (see [Command Line Arguments](automatic_walk_time_tables/Command_Line_Arguments.md) are accepted
  the same way as they are passed to the python script).
- Returns a JSON with the following fields:
    - `status`: `submitted` or `error`
    - `uuid`: uuid of the created walk-table (only if `status`=`submitted`)
    - `message`: Error message (only if `status`=`error`)

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
    - `status`: `submitted`, `running`, `error`, `finished`
    - `message`: Message
    - `last_change`: Timestamp of the last change

If the status is `finished`, the file can be downloaded via the `/download/[uuid]` endpoint.

### /download/[uuid] [GET]

Returns a ZIP folder containing the files created by the generator or a string with an error message.

### /parse_route [GET]

- Should contain the route file (GPX- or KML-file) as `file` in the request.

Returns a JSON with the following fields:

- `status`: The status of the file parsing (`Fehler` oder `Fertig`)
- `route`: encoded polyline representation of the path in LV95 coordinates
- `uuid`: of the request
