# Build Stage
FROM node:20-alpine3.19 AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build the docs
COPY . ./
RUN npm run docs:build


FROM nginx:1.23.2-alpine

# Copy the builded docs
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# Copy the nginx config
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Start the nginx server
CMD nginx -g "daemon off;"