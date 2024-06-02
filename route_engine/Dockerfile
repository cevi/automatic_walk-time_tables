FROM ghcr.io/gis-ops/docker-valhalla/valhalla:latest

USER root

# install python
RUN apt-get update && apt-get install -y python3 python3-pip libgdal-dev

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER valhalla
ENTRYPOINT ["/entrypoint.sh"]
CMD ["build_tiles"]