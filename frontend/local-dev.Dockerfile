# Use official node image as the base image
FROM node:20.13.1-alpine3.20

# Set the working directory
WORKDIR /app

# Install app dependencies
COPY ./frontend/*.json /app/

# Install all the dependencies from package-lock.json
RUN npm ci
RUN npm install -g typescript

# Copy project directory
COPY ./frontend/ /app/

# Prebuilds the angular application
RUN npm run build:docker

# Generate the build of the application. Note how we copy the node-context folder
CMD ls && npm run start:docker
