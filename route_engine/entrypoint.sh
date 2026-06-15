#!/bin/bash

# The Google Drive ID for the pre-built routing graph container archive (valhalla_tiles.tar).
# If you build a new graph locally, upload it to drive and swap this string!
VALHALLA_TILE_ID="1lkrS268Mphtifxmdw0UHVnR9_cNErNks"
INDEX_CACHE_VERSION="v3-2026-04-07" # Bump this to force download

VERSION_FILE="/custom_files/.version"
CURRENT_VERSION=""
if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(cat "$VERSION_FILE")
fi

NEEDS_DOWNLOAD=false
if [ -z "$(ls -A /custom_files | grep -Ev '^(\.gitkeep|file_hashes\.txt|\.version)$')" ]; then
  NEEDS_DOWNLOAD=true
elif [ "$CURRENT_VERSION" != "$INDEX_CACHE_VERSION" ]; then
  NEEDS_DOWNLOAD=true
fi

if [ "$NEEDS_DOWNLOAD" = true ]; then
  echo "Index version mismatch or missing local files. Pulling default graph from GDrive..."

  # Install dependencies for downloading files
  sudo apt update
  sudo apt install python3-pip -y
  python3 -m pip install --break-system-packages gdown

  # pip install gdown
  export PATH=$PATH:/home/valhalla/.local/bin

  # clear /custom_files safely
  find /custom_files -mindepth 1 | grep -Ev '^/custom_files/(\.gitkeep|file_hashes\.txt)$' | xargs sudo rm -rf
  sudo chmod 777 /custom_files

  # download pre-computed valhalla tiles
  # these tiles are generated based on swissTLM3D released at 2026-04
  gdown $VALHALLA_TILE_ID -O /custom_files/
  
  # rename the downloaded file
  mv /custom_files/valhalla_tiles_*.tar /custom_files/valhalla_tiles.tar
  
  # save the new version
  echo "$INDEX_CACHE_VERSION" > "$VERSION_FILE"

  echo "Default files downloaded successfully"
fi

# start default entrypoint
if [ -f "$VERSION_FILE" ]; then
  echo "Starting Valhalla with cache version: $(cat "$VERSION_FILE")"
else
  echo "Starting Valhalla with no cache version metadata."
fi
echo "Starting default entrypoint..."
/valhalla/scripts/run.sh "$@"
