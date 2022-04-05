#!/bin/bash

set -e

# Create NameIndex Files
echo "Starting: generate_index_file.py"
python3 generate_index_file.py

# Start Backend Server
echo "Start Backend Server"
exec gunicorn --bind :5000 --workers 1 --threads 2 --timeout 60 app:app