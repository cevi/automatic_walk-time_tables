# How to run the script?

Make sure you have installed python 3 and all requirements listed in the requirements.txt file. Now you can
run ```main.py``` to launch the script. The produced files get saved in the ```./output``` directory. In
the ```main.py``` you can specify the ```DEPARTURE_TIME```, ```GPX_FILE_PATH```, and ```VELOCITY``` as command-line
arguments, see table bellow.

Note: the script is only tested with GPX-files exported form SchweizMobil and from the official swisstopo app, but it
should work with arbitrary GPX-files.

## Settings: Supported command-line args

All arguments are optional (or have a default value). However, the arguments allow choosing various settings.

Name | arguments | Description
--- | --- | ---
|  |
`--gpx-file-name` | `String` | Name and path to the GPX file, if not specified ```./GPX/Default_Route.gpx```  will be used as default value.
`--velocity` | `Float` | Speed in km/h on which the calculation is based, default 3.75 km/h.
`--map-scaling` | `Integer` | Scaling of the created map (e.g. 10000 for scaling of 1:10'000). If not specified, the scaling will be automatically chosen such that the path can be printed onto a single A4 paper. The scaling gets chosen out of a list of common map scaling: 1:10'000, 1:25'000, 1:50'000, 1:100'000, or 1:200'000.
`--open-images` | None | If this flag is set, the created images will be shown (i.g. elevation plot will be opened after its creation). For this feature a desktop environment is needed.
`--departure-time` | ISO-timestamp | Departure date in ISO-format, i.g. 2011-11-04T00:05:23. Default 2021-08-16T09:00:00.
`--creator-name` | `String` | The name of the creator of this walk-table. Default is just an empty string.

## About swisstopo Services

This script highly depends on the services form swisstopo (Federal Office of Topography swisstopo). Those services are
free-of-charge and do not require registration (since 01.03.2021). However, we should follow there "Fair Use" rules.
More details see [API documentation](https://api3.geo.admin.ch/services/sdiservices.html)
and [Terms of use](https://www.geo.admin.ch/de/geo-dienstleistungen/geodienste/terms-of-use.html).

Thus, in some cases, e.g. finding a swisstopo name for a coordinate, we will not use the official API but rebuild the
query algorithm locally. Therefore, please make sure, you have downloaded the necessary files in the ./res folder. The
files needed include ```swissNAMES3D_LIN.csv```, ```swissNAMES3D_PKT.csv```, and ```swissNAMES3D_PLY.csv```.