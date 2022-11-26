FROM python:3.11.0-slim

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Needed for RTree pip package
RUN apt update
RUN apt -y install libspatialindex-dev curl

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 1848

# Entrypoint
CMD gunicorn --bind :1848 --workers 1 --threads 2 --timeout 60 app:app