# Command Line Arguments

## Required Arguments

| Name                | arguments | Description                                                                |
|---------------------|-----------|----------------------------------------------------------------------------|
| `-fn` `--file-name` | `String`  | Name and path to the route file (e.g. GPX or KML file). Required Argument. |

### Settings: Optional Arguments

| Name                      | arguments       | Description                                                                                                                                                                                                                                                                                               |
|---------------------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `-v` `--velocity`         | `Float`         | Speed in km/h on which the calculation is based, default 3.75 km/h.                                                                                                                                                                                                                                       |
| `-s` `--map-scaling`      | `Integer`       | Scaling of the created map (e.g. 10000 for scaling of 1:10'000). If not specified, the scaling will be automatically chosen such that the path can be printed onto a single A4 paper. The scaling gets chosen out of a list of common map scaling: 1:10'000, 1:25'000, 1:50'000, 1:100'000, or 1:200'000. |
| `-t` `--departure-time`   | `ISO-timestamp` | Departure date in ISO-format, i.g. 2011-11-04T00:05:23. Default 2021-08-16T09:00:00.                                                                                                                                                                                                                      |
| `-n` `--creator-name`     | `String`        | The name of the creator of this walk-table. Default is just an empty string.                                                                                                                                                                                                                              |
| `--output_directory`      | `String`        | Subdirectory in the output folder for storing the created files. Should be empty or ending with "/"                                                                                                                                                                                                       |
| `--print-api-base-url`    | `String`        | Base URL of the mapfish server used for creating PDF exports. Default: localhost.                                                                                                                                                                                                                         |
| `--legend-position`       | `String`        | Position of the legend on the map. Default: bottom-right.                                                                                                                                                                                                                                                 |
| `--map-layers`            | `String`        | Comma separated list of map layers to be used. Default: "ch.swisstopo.pixelkarte-farbe".                                                                                                                                                                                                                  |
| `--list-of-pois`          | `String`        | List of point of interests. One coordinate (LV03) pair per line separated by comma, line end marked with "\n", e.g. "623345,256023;625345,253023"                                                                                                                                                         | 
| `--name-points-in-export` | `Boolean`       | If this flag is set, the marked waypoints in the map will be named. Default is true.                                                                                                                                                                                                                      |

### Flags: Enable/Disable Features

| Name                         | arguments | Description                                                                                                                                                      |
|------------------------------|-----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--create-map-pdfs`          | `Boolean` | Enable/Disable export as PDF. Require a running MapFish docker container. Enabled as default (True).                                                             |
| `--create-excel`             | `Boolean` | Enable/Disable creation of the walk-time table as excel. Enabled as default (True).                                                                              |
| `--create-elevation-profile` | `Boolean` | Enable/Disable creation of the elevation profile as PNG. Enabled as default (True).                                                                              |
| `--open-images`              | `None`    | If this flag is set, the created images will be shown (i.g. elevation plot will be opened after its creation). For this feature a desktop environment is needed. |
