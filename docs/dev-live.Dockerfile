# Build Stage
FROM node:17

WORKDIR /app

COPY package*.json ./
RUN npm ci

CMD npm run docs:dev /app/src