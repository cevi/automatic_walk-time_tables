# Swiss TLM API Endpoints

## Endpoints

### /names [POST]

Names a list of LV95 coordinates.

- Body: `{"points": [[e, n], ...]}`
- Returns `{"names": [...]}` with one description per point, in the same order. The fields are the same as for
  `/swiss_name` below.

The name is chosen among the objects of the index around the point: an object at the point (within 15 m) is preferred
over anything nearby, and huts, passes, lakes and summits win within their radius. A fork named after a single street
(`Weggabelung Letziweg`) is named after the nearest field name within 100 m instead (`Weggabelung bei Ob der Hueb`),
as street names are not printed on the 1:25'000 map.

### /features_along_route [POST]

All objects of the index close to a route, used by the backend to find landmarks for the way point selection.

- Body: `{"route": [[e, n], ...], "corridor": 25}` (LV95; corridor in meters, at most 100)
- Returns `{"features": [{"name", "object_type", "e", "n", "h", "offset"}, ...]}`; `offset` is the distance of the
  object to the route in meters.

### /swiss_name [GET]

Deprecated, use `/names`.

For a list of coordinates this API endpoint returns a list of descriptions for the corresponding points.

- The post should contain a JSON body with a list of LV95 coordinates encoded as JSON
- Returns a JSON array with point descriptions. Each description has the following fields:
    - `lv95_coord`: LV95 coordinates of the nearest swiss name point
    - `offset`: distance between the swiss name point and the requested coordinates in meters
    - `object_type`: type of the swiss name
    - `swiss_name`: German description of the swiss name point, e.g. a _Flurname_

#### Example:

Body of the request:

```JSON
[
  [
    2662904.1583168027,
    1217708.1316288968
  ],
  [
    2663593.9,
    1217972.6
  ]
]
```

Possible response:

```JSON
[
  {
    "lv95_coord": [
      2662783,
      1217862
    ],
    "object_type": "Flurname swisstopo",
    "offset": 196,
    "swiss_name": "Holzhüsere"
  },
  {
    "lv95_coord": [
      2663658,
      1217973
    ],
    "object_type": "Waldrand",
    "offset": 64,
    "swiss_name": "Waldrand"
  }
]
```

### /map_numbers [GET]

For a list of coordinates this API endpoint returns a string containing the numbers of the official maps covering the
path.

- The request should contain a JSON body with a list of LV95 coordinates 
- Returns a string containing the numbers of the official maps covering the path.

#### Example:

Body of the request:

```JSON
[
  [
    2662904,
    1217708
  ],
  [
    2663593.9,
    1217972.6
  ]
]
```

Possible response:

```
Ricken (LK 1113)
```