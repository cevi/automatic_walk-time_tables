# Runtime Modes and Environment Variables

The application can be run in different runtime modes and with different environment variables.

We distinguish between runtime modes and environment files. The former are defined using
`docker-compose.yml` files, the latter are defined inside environment files (`.env.*`).

Runtime modes and environment Variables may influence the behaviour of the application.

::: tip
The default runtime mode is `local-dev` with it's associated configuration file `.env.local-dev`.

It enables hot reloading/rebuilding, which is useful to develop the application.
:::

## Available Runtime Modes - How the Application is Launched

Runtime modes are defined using `docker-compose.yml` files. They define how the application is launched.

Runtime Modes may change the behaviour of the application. An incomplete list of affected parts consists of the
following:

- whether hot reloading/rebuilding is enabled or not
- if the application is run in using a nginx server instead of the angular's built-in development server

The following runtime modes are available:

| Environment   | Purpose                                                                                                                                       | Default Domain Binding |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------|------------------------|
| `prod-latest` | Production runtime environment, as hosted on [map.cevi.tool](https://map.cevi.tool).                                                          | `map.cevi.tool`        |
| `prod-dev`    | Same as production mode but with different environment variables and image tags. As hosted on [dev.map.cevi.tool](https://dev.map.cevi.tool). | `dev.map.cevi.tool`    |
| `local-dev`   | Development runtime environment with enabled hot reloading/rebuilding usefully to develop the application                                     | `localhost`            |
| `ci-testing`  | Used to test the application. We are using  [cypress](https://www.cypress.io/) for testing.                                                   | `localhost`            |

To specify a mode, you can extend the docker-compose command with the `-f` flag, specifying an additional
`docker-compose.*.yml` file.

For example, to launch the `prod-dev` runtime environment, you can use the following command:

```bash
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod-dev.yml up [--build]
```

::: info
`--build` is optional and forces docker to rebuild the containers.
:::

## Environment Variables - How the Application Behaves

Each runtime mode has its own environment file assigned. The environment file contains environment variables, which are
used to configure the application and change its behavior. The environment file is loaded by docker-compose and passed
to the application.

Environment variables may change the behaviour of the application. An incomplete list of affected parts consists of the
following:

- the logging level
- the port and domain the application uses to call the backend
- the build mode and compression of the Angular frontend

### Domain Binding - Running on Localhost

Depending on the runtime environment, you must overwrite the environment variable `BACKEND_DOMAIN` to `localhost` if you
want to run the application on your local machine. Setting `BACKEND_DOMAIN` to `http://localhost:5000` will cause the
application to bind to `localhost:5000` instead of the default domain binding listed above.

Alternatively, you can force the application to bind to a specific domain by setting `BACKEND_DOMAIN` to the domain, you
want to bind to. This is useful if you want to run the application on a different domain than the
default domain binding.

::: info

The URL must not contain a trailing slash but include the protocol (e.g. `http://` or `https://`).
E.g. specified as `http://localhost:5000` or `https://map.cevi.tool`.
:::

To force the `prod-latest` runtime environment to run on localhost, you can use the following command:

```bash
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod-latest.yml \ 
  -e DOMAIN=localhost up [--build]
```

## Runtime Modes

### Runtime Mode: `prod-latest`

The production environment is the environment, which is used to host the application
on [map.cevi.tool](https://map.cevi.tool). You can use the following command to start the application in production
mode:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod-latest.yml up --build
```

In this mode all webservers use a nginx server to serve the application.

#### Environment Variables

The production environment is configured as follows:

```
ANGULAR_BUILD_MODE=production
BACKEND_DOMAIN=https://map.cevi.tools
```

Which causes the following behaviour:

- **Optimized Build:** In the production environment the application runs in optimized mode, which means that the
  frontend is compressed and minified.
- **Logging Level:** The logging level is set to `warn`.
- **Domain Binding:** The backend domain is set to `https://map.cevi.tools`.

::: tip
You can force the application to bind to a specific domain by setting the environment variable `DOMAIN`.
See [Domain Binding](/documentation/introduction/environment#domain-binding-running-on-localhost).
:::

#### Docker Image Tags

The docker images are tagged in the following way:

```
registry.cevi.tools/cevi/awt_{{service name}}>:latest
```

### Runtime Mode: `prod-latest`

Similar to the production environment, but with different environment `BACKEND_DOMAIN` and image tags.

#### Docker Image Tags

The docker images are tagged in the following way:

```
registry.cevi.tools/cevi/awt_{{service name}}>:dev
```

### Runtime Mode: `local-dev`

In this mode the application is run using the Angular development server. This mode is useful to develop the application
and enables hot reloading/rebuilding. Reloading is also enabled for the backend and documentation server.

To start the application in `local-dev` mode, you can use the following command:

```bash
docker-compose up --build
```

#### Docker Image Tags

Docker images are not tagged in this mode.

### Runtime Mode: `test`

This mode is used to test the application. We are using [cypress](https://www.cypress.io/) for testing.
More information about testing can be found in the [testing section](/documentation/introduction/testing).

To start the application in `test` mode, you can use the following command:

```bash
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.ci-testing.yml \
  up --build
```

#### Docker Image Tags

Docker images are not tagged in this mode.
