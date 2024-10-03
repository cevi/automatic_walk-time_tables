FROM ghcr.io/gis-ops/docker-valhalla/valhalla:latest

USER root
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER valhalla
ENTRYPOINT ["/entrypoint.sh"]
CMD ["build_tiles"]