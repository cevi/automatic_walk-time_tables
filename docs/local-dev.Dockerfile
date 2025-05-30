# Build Stage
FROM node:18.12-alpine3.16

WORKDIR /app

COPY package*.json ./
RUN npm ci

CMD npm run docs:dev /app/src