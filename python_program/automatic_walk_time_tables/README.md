# Automatic Walk-Time Tables (Module)

## Minimal working example:

```python
from automatic_walk_time_tables import arg_parser
from automatic_walk_time_tables.generator import AutomatedWalkTableGenerator

# parse the command line arguments, see docs
args = arg_parser.get_parser().parse_args()

gen = AutomatedWalkTableGenerator(args)
gen.run()
```

_Note: The script is only tested with GPX-files exported form SchweizMobil and from the official swisstopo app, as well
as for KML files from map.geo.admin.ch, but it should work with arbitrary GPX- or KML-files._

## Dependence on swisstopo Services
This script highly depends on the services form swisstopo (Federal Office of Topography swisstopo). But to respect the
faire-use-limits, we will not always use the official API. Therefore, pleasemake sure, you have downloaded the necessary
files in the `./res` folder. The files needed include ```swissNAMES3D_LIN.csv```, ```swissNAMES3D_PKT.csv```,
and ```swissNAMES3D_PLY.csv```.