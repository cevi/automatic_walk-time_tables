
# Stage 1: Compile and Build angular codebase
# Use official node image as the base image
FROM node:16 as build

# Set the working directory
WORKDIR /app

# Install app dependencies
COPY ./webinterface/package*.json ./

# Install all the dependencies from package-lock.json
RUN npm ci

# Add the source code to app
COPY ./webinterface/ /app/
COPY ./.git/HEAD /app/.git/HEAD
COPY ./.git/refs/heads/ /app/.git/refs/heads/

# Copy environment variables and export enviroment variables
# This step is necessary as the environment variables are used on build time
ARG ENVIRONMENT_FILE
COPY ./${ENVIRONMENT_FILE} /app/${ENVIRONMENT_FILE}

# Generate the build of the application
RUN export $(grep -v '^#' ./${ENVIRONMENT_FILE} | xargs) && \
    npm run build:docker

# Stage 2: Serve app with nginx server
# Use official nginx image as the base image
FROM nginx:1.23

# copy the nginx configuration file to the container
COPY ./webinterface/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the build output txo replace the default nginx contents.
COPY --from=build /app/dist/automatic-walk-time-tables /usr/share/nginx/html

# Expose port 80
EXPOSE 80
