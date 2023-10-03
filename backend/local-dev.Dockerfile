FROM python:3.11.0-slim

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Install requirements
COPY ./automatic_walk_time_tables/requirements.txt /app/automatic_walk_time_tables/
RUN pip install --no-cache-dir -r automatic_walk_time_tables/requirements.txt

COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

# no need to copy "." to /app (it is mounted by the docker-compose.yml file in the project root)

EXPOSE 5000

# Entrypoint
CMD gunicorn --bind :5000 --workers 1 --threads 2 --timeout 60 --reload app:app