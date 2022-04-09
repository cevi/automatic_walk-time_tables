#!/bin/bash

set -e

# Start Backend Server
echo "Start Backend Server"
exec gunicorn --bind :1848 --workers 1 --threads 1 --timeout 60 app:app