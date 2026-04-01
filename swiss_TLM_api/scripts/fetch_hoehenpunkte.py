import urllib.request
import json
import os
import ssl
import zipfile
import shutil
import fiona

STAC_URL = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swiss-map-vector25/items"
RESOURCE_DIR = "/app/resources/swissNAMES3D_data"
OUTPUT_SHP = os.path.join(RESOURCE_DIR, "SMV25_HOEHENKOTEN.shp")


def fix_backslash_extract(zip_path, extract_dir):
    with zipfile.ZipFile(zip_path, "r") as z:
        for zip_info in z.infolist():
            fixed_name = zip_info.filename.replace("\\", "/")
            if not fixed_name.endswith("/"):
                try:
                    z.extract(zip_info, path="/tmp/extract_temp")
                    actual_path = os.path.join("/tmp/extract_temp", zip_info.filename)
                    target_path = os.path.join(extract_dir, fixed_name)
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    os.rename(actual_path, target_path)
                except Exception as e:
                    pass


def main():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    print("[INFO] Fetching SMV 25 STAC URLs...")
    url = STAC_URL
    gdb_urls = []

    while url:
        req = urllib.request.urlopen(url, context=ctx)
        data = json.loads(req.read())
        for feature in data.get("features", []):
            for asset in feature.get("assets", {}).values():
                href = asset.get("href", "")
                if "2025" in href and href.endswith(".gdb.zip"):
                    gdb_urls.append(href)
        url = next(
            (l["href"] for l in data.get("links", []) if l["rel"] == "next"), None
        )

    print(f"[INFO] Found {len(gdb_urls)} SMV25 .gdb.zip tiles to process.")

    os.makedirs(RESOURCE_DIR, exist_ok=True)
    schema = {"geometry": "Point", "properties": {"HOEHE": "int"}}

    total_written = 0
    with fiona.open(
        OUTPUT_SHP, "w", driver="ESRI Shapefile", crs="EPSG:2056", schema=schema
    ) as output:
        for idx, download_url in enumerate(gdb_urls):
            print(
                f"[INFO] Processing tile {idx+1}/{len(gdb_urls)} | Points so far: {total_written}"
            )
            zip_path = "/tmp/smv25_tile.zip"
            extract_dir = "/tmp/smv25_extracted"

            if os.path.exists(zip_path):
                os.remove(zip_path)
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)
            if os.path.exists("/tmp/extract_temp"):
                shutil.rmtree("/tmp/extract_temp")
            os.makedirs(extract_dir, exist_ok=True)
            os.makedirs("/tmp/extract_temp", exist_ok=True)

            os.system(f"curl -L -o {zip_path} -s {download_url}")
            fix_backslash_extract(zip_path, extract_dir)

            gdb_dir = None
            for p in os.listdir(extract_dir):
                if p.endswith(".gdb"):
                    gdb_dir = os.path.join(extract_dir, p)
                    break

            if not gdb_dir:
                for root, dirs, files in os.walk(extract_dir):
                    if root.endswith(".gdb"):
                        gdb_dir = root
                        break

            if gdb_dir:
                try:
                    layers = fiona.listlayers(gdb_dir)
                    target_layer = next(
                        (
                            l
                            for l in layers
                            if "HOEHENKOTE" in l.upper()
                            and "ANNO" not in l.upper()
                            and "MASK" not in l.upper()
                        ),
                        None,
                    )

                    if target_layer:
                        with fiona.open(gdb_dir, layer=target_layer) as src:
                            for feature in src:
                                try:
                                    h = feature["properties"].get("HOEHE", 0)
                                    output.write(
                                        {
                                            "geometry": feature["geometry"],
                                            "properties": {"HOEHE": int(h)},
                                        }
                                    )
                                    total_written += 1
                                except Exception:
                                    pass
                except Exception as e:
                    print(f"Skipped GDB due to error: {e}")

    # Final cleanup
    if os.path.exists("/tmp/smv25_tile.zip"):
        os.remove("/tmp/smv25_tile.zip")
    if os.path.exists("/tmp/smv25_extracted"):
        shutil.rmtree("/tmp/smv25_extracted")
    if os.path.exists("/tmp/extract_temp"):
        shutil.rmtree("/tmp/extract_temp")
    print(f"[SUCCESS] Completed. Total Points Written: {total_written}")


if __name__ == "__main__":
    main()
