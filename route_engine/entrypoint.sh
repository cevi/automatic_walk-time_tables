#!/bin/bash

# check if /custom_files contains some files apart from .gitkeep
if ! [ "$(ls -A /custom_files | grep -Ev '.gitkeep' | file_hashes.txt)" ]; then

  echo "No custom files found in /custom_files. Start downloading default files..."

  # Install gdown
  pip install gdown --break-system-packages
  export PATH=$PATH:/home/valhalla/.local/bin

  gdown --id 1lkrS268Mphtifxmdw0UHVnR9_cNErNks -O /custom_files/

  echo "Default files downloaded successfully"

fi

# start default entrypoint
echo "Starting default entrypoint..."
/valhalla/scripts/run.sh "$@"
