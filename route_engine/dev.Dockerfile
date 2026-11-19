FROM ghcr.io/gis-ops/docker-valhalla/valhalla:latest

USER root
# gdown downloads the pre-built routing tiles (see entrypoint.sh). It is installed here, not when the container
# starts: installing it at startup made CI depend on the Ubuntu mirror and pulled in a whole compiler toolchain.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-pip \
    && python3 -m pip install --no-cache-dir --break-system-packages gdown \
    && rm -rf /var/lib/apt/lists/*
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER valhalla
ENTRYPOINT ["/entrypoint.sh"]
CMD ["build_tiles"]