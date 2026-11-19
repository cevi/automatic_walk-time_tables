# Swiss TLM API Endpoints

## Endpoints

### /names [POST]

Names a list of LV95 coordinates.

- Body: `{"points": [[e, n], ...]}`
- Returns `{"names": [...]}` with one description per point, in the same order. The fields are the same as for
  `/swiss_name` below.

The name is chosen among the objects of the index around the point: an object at the point (within 15 m) is preferred
over anything nearby, and huts, passes and summits win within their radius. The aim is a name printed on the
1:25'000 map:

- A fork named after a single street (`Weggabelung Letziweg`) is named after the nearest field or place name within
  100 m instead (`Weggabelung bei Ob der Hueb`, `Weggabelung bei Lettenhof`), as street names are not printed.
- A spot height within 25 m beats a junction and a stream crossing without a name (`Punkt 846`), and gets the nearest
  village or hamlet within 250 m, else the nearest field name: `Punkt 584 (Banco)`. A bus stop with a spot height
  within 15 m is named after the spot height, as bus stop names are not printed.
- The shore of a small lake (at most 400 m long, see `index_builder/swissnames_areas.py`) names the points within
  30 m: `Stadlersee`. Larger lakes are not in the index, they would name many points of a route the same.
- If no object is within its radius, the nearest named object within 100 m is used, else the name is empty.

Each description also has `alternatives`: the next best other names (`[{"swiss_name", "object_type", "offset"}]`).
The backend uses them for a second place of a route that would get the same name.

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