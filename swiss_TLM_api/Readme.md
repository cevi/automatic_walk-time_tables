# API for the Swiss Topographic Landscape Model (TLM)

The topographic landscape model is a database for three-dimensional geodata provided by Swisstopo. We use various parts
of their dataset during the calculation of the walk-time table, e.g. in the point selecting algorithm or during name
finding. All this data can be queried with an internal API specified in this docker container.

More information about the topographic landscape model can be found here:
[Federal Office of Topography](https://www.swisstopo.admin.ch/en/knowledge-facts/topographic-landscape-model.html).

## API API_Endpoints

- name finding: find name for given point / points
- calc POIs for a given route, i.g. for a given route the API returns a list along the path with POIs. We understand
  PIOs as points with a special / precise naming, e.g. the peak of a mounten, a river crossing, a fire place, etc.

**Future Endpoints**:

- route calculation, given two points, the API returns a list of points describing a route between the two.

## Prerequisites

Make sure to download the latest version of the topographic landscape model dataset here:
from https://www.swisstopo.admin.ch/de/geodata/landscape/tlm3d.html.

And store it in the directory `./res/swissTLM3D_1.9_LV95_LN02_shp3d/`. Currently, we only need the `.shp` files.

## Testing of Name Finding Algorithm

The name finding algorithm can be tested with a python script. This script creates an image which contains a randomly
selected point along a very long GPX file path. The point gets annotated using the name finding algorithm.

```bash
$ python3 test_name_finding.py 
```
