FROM cypress/included:12.6.0

WORKDIR /opt

RUN apt install -y unzip

COPY package.json .
COPY package-lock.json .
RUN npm ci

WORKDIR /opt/e2e
RUN npx cypress verify