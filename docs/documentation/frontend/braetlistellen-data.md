# Updating Brätlistellen Data

The frontend includes a pre-processed TypeScript map of public fire pits (Brätlistellen) to cross-reference with OpenStreetMap data and provide external links to `braetlistellen.ch` within the MapViewer's feature popups. 

The data is stored statically in `frontend/src/assets/braetlistellen.ts` to ensure fast load times and no runtime API overhead.

## Update Process

If the original UMap dataset gets updated, you can refresh the local file using the following Python script. The script downloads the UMap GeoJSON layer, projects the coordinates from `EPSG:4326` (WGS 84) to `EPSG:2056` (LV95, as used by Swisstopo), and outputs a TypeScript array.

### Dependencies
Ensure you have `pyproj` and `requests` installed:
```bash
pip install pyproj requests
```

### Conversion Script
Run the following script from the project root. It will fetch the latest layer and format it directly into the `braetlistellen.ts` file:

```python
import json
import requests
from pyproj import Transformer

# UMap Datalayer URL
UMAP_URL = "https://umap.osm.ch/de/datalayer/2360/4d04ab84-f19a-4892-80bf-cb26ed4d19fb/"
OUTPUT_FILE = "frontend/src/assets/braetlistellen.ts"

print("Fetching latest UMap data...")
response = requests.get(UMAP_URL)
response.raise_for_status()
data = response.json()

print("Projecting coordinates...")
# OpenLayers uses EPSG:2056
transformer = Transformer.from_crs("epsg:4326", "epsg:2056", always_xy=True)

output = []
for feature in data.get('features', []):
    geom = feature.get('geometry')
    props = feature.get('properties', {})
    
    if geom and geom.get('type') == 'Point':
        lon, lat = geom['coordinates']
        x, y = transformer.transform(lon, lat)
        
        output.append({
            'x': x,
            'y': y,
            'name': props.get('name', ''),
            'url': props.get('description', '')
        })

print(f"Writing {len(output)} features to {OUTPUT_FILE}...")
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write("export const braetlistellenData = ")
    json.dump(output, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print("Done!")
```

After updating the data, rebuild the frontend or commit the newly updated file to version control.
