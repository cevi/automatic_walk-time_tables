FROM python:3.11.0-slim

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

# no need to copy "." to /app (it is mounted by the docker-compose.yml file in the project root)

EXPOSE 6000

# Entrypoint
CMD gunicorn --bind :6000 --workers 1 --threads 2 --timeout 60 --reload app:app