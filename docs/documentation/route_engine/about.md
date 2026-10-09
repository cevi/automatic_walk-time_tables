# Route Engine (Valhalla)

Details can be found on GitHub: [Route Engine](https://github.com/valhalla/valhalla).

## Generating and Updating the Valhalla Index for Production
Due to the massive memory footprint (upwards of ~32GB RAM) required to index the unified Swiss network into a navigable `.tar` file, we pre-compute the Valhalla index on beefy local hardware and host it on Google Drive. This enforces rapid deployment boots downstream in production!

Whenever you update Swisstopo data or tweak parsing rules within `route_engine/helper_scripts/converter.py`, follow these steps to deploy the new routing graph:

### 1. Build the Data Context (OSM.PBF)
You first need to translate Swisstopo `SHP` parameters into OSM tags that our dynamic Map/ECharts configuration can read.
1. Place your downloaded Swisstopo directory inside `route_engine/resources/routing_shp/`
2. Run the internal converter bridge to spit out an `osm.pbf` file:
```bash
cd route_engine/helper_scripts
docker build -t shp_to_osm .
docker run --rm -v $(pwd)/../resources/routing_shp:/data shp_to_osm
```
3. Move the generated `swissTLM3D_TLM_STRASSE.osm.pbf` file upstream into `route_engine/sources/`:
```bash
cp ../resources/routing_shp/*.osm.pbf ../sources/
```

### 2. Generate the Valhalla .tar Archive
Clear out any old files (you should only have your `.osm.pbf` and `.gitkeep` inside `route_engine/sources/`).
Execute Valhalla interactively to force a tile compilation sweep from the top-level route engine directory. **When prompted, type `y` to safely wipe all old Valhalla artifacts** before generating the new data:
```bash
cd route_engine
sudo rm -rf sources/valhalla_tiles.tar sources/valhalla_tiles sources/valhalla.json sources/duplicateways.txt sources/file_hashes.txt
docker run --rm -v $(pwd)/sources:/custom_files -e build_tar=True -e use_tiles_ignore_pbf=False -e force_rebuild=True ghcr.io/gis-ops/docker-valhalla/valhalla:latest
```
After a few moments, this will output a ~400MB `valhalla_tiles.tar` file into the `sources` folder.

### 3. Upload to Google Drive
1. Upload your new `valhalla_tiles.tar` to your standard engineering Google Drive folder.
2. Enable direct access (`Anyone with the link can view`).
3. Extract the raw **File ID** string from the URL `.../file/d/[FILE_ID]/view`.

### 4. Bump the Container Cache Version
Open up `route_engine/entrypoint.sh` in the codebase.
1. Paste your new drive hash into `VALHALLA_TILE_ID`:
   ```bash
   VALHALLA_TILE_ID="[FILE_ID]"
   ```
2. **Bump** the `INDEX_CACHE_VERSION` identifier! E.g. `v3-2027-01-01`.

Commit these changes. Upon the next deployment cycle on the hosting servers, Valhalla's entrypoint script will see the version increment, automatically wipe the stalemated local graph mappings in its volume, and securely redownload your crisp new version!