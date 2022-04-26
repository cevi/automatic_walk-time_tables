FROM python:3.9

WORKDIR /app

# Needed for RTree pip package
RUN apt update
RUN apt -y install libspatialindex-dev

# Install requirements
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 1848

RUN chmod +x ./entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]