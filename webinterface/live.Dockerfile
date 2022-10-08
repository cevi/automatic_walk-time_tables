# Use official node image as the base image
FROM node:16

# Set the working directory
WORKDIR /app

# Install app dependencies
COPY ./webinterface/*.json /app/

# Install all the dependencies from package-lock.json
RUN npm ci
RUN npm install -g typescript

# Copy project directory
COPY ./webinterface/ /app/

# Generate the build of the application. Note how we copy the node-context folder
CMD ls && npm run start:docker
