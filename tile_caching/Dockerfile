FROM nginx:1.30.5-alpine

ADD nginx.conf /etc/nginx/nginx.conf

# make dir /data/nginx/cache and set ownership
RUN mkdir -p /data/nginx/cache && chown -R nginx:nginx /data/nginx/cache
