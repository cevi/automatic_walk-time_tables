FROM mendlik/nginx:1.0.0

ARG BUILD_DATE
ARG VERSION
ARG VCS_REF
ARG VCS_URL
LABEL org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url=$VCS_URL \
      org.label-schema.version=$VERSION

COPY nginx.conf /etc/nginx/nginx.conf