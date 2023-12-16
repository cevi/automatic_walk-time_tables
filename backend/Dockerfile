FROM python:3.11.2-slim

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 5000

# Entrypoint
CMD gunicorn --bind :5000 --workers 1 --threads 2 --timeout 60 app:app