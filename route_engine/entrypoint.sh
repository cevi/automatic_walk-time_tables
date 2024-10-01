#!/bin/bash

# check if /custom_files contains some files apart from .gitkeep or file_hashes.txt
# (the latter is should be ignored to recover from failed downloads / startups)
if ! [ "$(ls -A /custom_files | grep -Ev '.gitkeep' | file_hashes.txt)" ]; then

  echo "No custom files found in /custom_files. Start downloading default files..."

  # Install dependencies for downloading files
  sudo apt update
  sudo apt install python3-pip -y
  python3 -m pip install --break-system-packages gdown

  # pip install gdown
  export PATH=$PATH:/home/valhalla/.local/bin

  # clear /custom_files
  sudo rm -rf /custom_files/*
  sudo chmod 777 /custom_files

  # download pre-computed valhalla tiles
  # these tiles are generated for valhalla version 3.5.0 or higher
  # based on swissTLM3D released at 2024-03
  gdown 11OUl2HTd0dVTdAC3CDHbXIOxEShx9gUz -O /custom_files/

  # rename the downloaded file
  mv /custom_files/valhalla_tiles_*.tar /custom_files/valhalla_tiles.tar

  echo "Default files downloaded successfully"

fi

# start default entrypoint
echo "Starting default entrypoint..."
/valhalla/scripts/run.sh "$@"
