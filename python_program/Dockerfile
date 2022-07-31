FROM python:3.9

WORKDIR /app

# Install requirements
COPY ./automatic_walk_time_tables/requirements.txt /app/automatic_walk_time_tables/
RUN pip install --no-cache-dir -r automatic_walk_time_tables/requirements.txt

COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 5000

ENV PRINT_API_BASE_URL=mapfish

# Entrypoint
CMD gunicorn --bind :5000 --workers 1 --threads 2 --timeout 60 app:app