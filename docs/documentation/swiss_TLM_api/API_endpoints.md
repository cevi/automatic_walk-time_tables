# Swiss TLM API Endpoints

## Endpoints

### /swiss_name [GET]

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