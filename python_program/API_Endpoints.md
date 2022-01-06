# API Documentation

## Endpoints

### /create [POST]
- Should contain the GPX as `file` in the request.
- Additional parameters (see [README.md](README.md) are accepted the same way as they are passed to the python script).
- Returns a JSON with the following fields:
    - `status`: `submitted` or `error`
    - `uuid`: uuid of the created walk-table (only if `status`=`submitted`)
    - `message`: Error message (only if `status`=`error`)

Example:
```
[HOST]/create?--velocity=4.5&--create-excel=false
```
Possible response:
```
{
    "status": "submitted",
    "uuid": "[uuid]",
}
```

### /status/[uuid] [GET]
- Returns a JSON with the following fields:
    - `status`: `submitted`, `running`, `error`, `finished`
    - `message`: Message
    - `last_change`: Timestamp of the last change

If the status is `finished`, the file can be downloaded via the `/download/[uuid]` endpoint.

### /download/[uuid] [GET]
Returns a ZIP folder containing the files created by the generator.
