#!/bin/bash

set -e

# Start Backend Server
echo "Start Backend Server"
exec gunicorn --bind :5000 --workers 1 --threads 2 --timeout 60 app:app