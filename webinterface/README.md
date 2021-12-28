# Automatic Walk-Time Tables: Webinterface

The application can be run inside a Docker container.

```bash
$ docker build . -t cevi/walktable_webinterface:latest
$ docker run --publish=80:80  cevi/walktable_webinterface:latest
```

You can specify the environment used by angular with the `--build-arg configuration=[env]` flag for the build command. Default is
development mode. Other modes are: 

* `configuration=prod_backend` which uses the productive backend, but serves angular not in production mode
* `configuration=production` which uses the productive backend and serve angular in production mode
* `configuration=development` serves angular in development mode and uses localhost as backend 

Example:
```bash
$ docker build . -t cevi/walktable_webinterface:latest --build-arg configuration=production
```

## Development with Live Reloading

For development, you can run the following commands.

1) Install node version 14, e.g. by using the [Node Version Manager](https://github.com/nvm-sh/nvm).

2) Launch the application by running the following command.

   ```bash
   $ npm install # install dependencies
   $ npm start # start local server
   ```
   Angular assumes the backend server is running at http://localhost:5000, you can change the backend server address by
   modifying the [environment file](src/environments/environment.ts). Or you can select the productive backend server by
   running:

   ```bash
   $ npm start -- --configuration prod_backend # start local server
   ```

