# Build Stage
FROM node:24.22.1-alpine3.24

WORKDIR /app

COPY package*.json ./
RUN npm ci

CMD npm run docs:dev /app/src