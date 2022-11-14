FROM cypress/included:11.0.1

WORKDIR /opt

COPY package.json .
COPY package-lock.json .
RUN npm ci

WORKDIR /opt/e2e
RUN npx cypress verify