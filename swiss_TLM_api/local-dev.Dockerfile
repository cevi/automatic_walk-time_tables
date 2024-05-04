FROM python:3.11.0-slim

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Needed for RTree pip package
RUN apt update \
    && apt -y install libspatialindex-dev curl gdal-bin libgdal-dev g++

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 1848

# Entrypoint
CMD gunicorn --bind :1848 --workers 1 --threads 2 --timeout 180 --reload 'app:create_app()'
