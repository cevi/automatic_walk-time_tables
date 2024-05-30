FROM ghcr.io/gis-ops/docker-valhalla/valhalla:latest

# install python
RUN sudo apt-get update && sudo apt-get install -y python3 python3-pip libgdal-dev

COPY ./entrypoint.sh /entrypoint.sh
RUN sudo chmod +x /entrypoint.sh

# set user to root
USER root

ENTRYPOINT ["/entrypoint.sh"]
CMD ["build_tiles"]