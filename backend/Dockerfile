FROM python:3.11.2-slim

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 5000

# Marks the container as unhealthy if no worker answers (e.g. gunicorn hangs on startup)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5)" || exit 1

# Entrypoint
CMD gunicorn --bind :5000 --workers 1 --threads 8 --timeout 60 app:app