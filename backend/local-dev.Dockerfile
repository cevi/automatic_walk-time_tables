FROM python:3.11.18-slim-bookworm

ENV PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# LibreOffice prints the walk-time table (Excel) as PDF. Liberation and Carlito are metric compatible
# with the Arial and Calibri fonts of the J+S template, the other fonts are substituted by the config.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-calc-nogui fonts-liberation fonts-crosextra-carlito \
    && rm -rf /var/lib/apt/lists/*
COPY ./docker/template-fonts.conf /etc/fonts/conf.d/99-template-fonts.conf

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

# no need to copy "." to /app (it is mounted by the docker-compose.yml file in the project root)

EXPOSE 5000

# Marks the container as unhealthy if no worker answers (e.g. gunicorn hangs on startup)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=5)" || exit 1

# Entrypoint
CMD gunicorn --bind :5000 --workers 1 --threads 2 --timeout 60 --reload app:app