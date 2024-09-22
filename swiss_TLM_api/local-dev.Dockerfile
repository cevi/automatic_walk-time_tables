# Build stage
FROM python:3.11.0-slim as build

# Environment variable to prevent pip from showing root warnings
ENV PIP_ROOT_USER_ACTION=ignore

# Set working directory
WORKDIR /app

# Install build dependencies (g++, libspatialindex-dev, gdal-dev) required to compile certain Python packages
RUN apt update \
    && apt -y install libspatialindex-dev gdal-bin libgdal-dev g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY ./requirements.txt /app

# Install dependencies in a temporary directory (which will be copied in the runtime phase)
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11.0-slim as run

# Set environment variable to avoid pip warnings
ENV PIP_ROOT_USER_ACTION=ignore

# Set working directory
WORKDIR /app

# Install runtime dependencies (curl, gdal-bin) without dev tools (g++ is no longer needed)
RUN apt update \
    && apt -y install curl gdal-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy the previously installed dependencies from the build stage
COPY --from=build /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
# COPY --from=build /usr/local/bin/ /usr/local/bin/

COPY --from=build /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=build /usr/local/bin/gunicorn /usr/local/bin/gunicorn

# Copy the rest of the application code
COPY . /app

# Expose the application port
EXPOSE 1848

# Define the entry point (running the application with Gunicorn)
CMD gunicorn --bind :1848 --workers 1 --threads 2 --timeout 180 --reload 'app:create_app()'
