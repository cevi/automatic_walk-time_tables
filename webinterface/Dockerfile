# Stage 1: Compile and Build angular codebase
# Use official node image as the base image
FROM node:14 as build

# Set the working directory
WORKDIR /usr/local/app

# Install app dependencies
COPY package*.json ./

# Install all the dependencies from package-lock.json
RUN npm install

# Add the source code to app
COPY ./ /usr/local/app/

# Generate the build of the application
RUN npm run build

# Stage 2: Serve app with nginx server
# Use official nginx image as the base image
FROM nginx:latest

# Copy the build output to replace the default nginx contents.
COPY --from=build /usr/local/app/dist/automatic-walk-time-tables /usr/share/nginx/html

# Expose port 80
EXPOSE 80
