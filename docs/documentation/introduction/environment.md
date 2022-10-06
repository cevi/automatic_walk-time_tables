# Environments

The application can be run in different environments, each with its own purpose. Environments may influence the
behaviour
of the application. An incomplete list of affected parts consists of the following:

- the logging level
- the port and domain the application uses to call the backend
- the build mode and compression of the Angular frontend

::: tip
The default environment is `dev-live`.

It enables live reloading/rebuilding, which is useful to develop the application.
:::

## Available Environments

The following table lists all environments and their purpose.

| Environment | Purpose                                                                                            | Default Domain Binding |
|-------------|----------------------------------------------------------------------------------------------------|------------------------|
| `prod`      | Production environment, as hosted on [map.cevi.tool](https://map.cevi.tool).                       | `map.cevi.tool`        |
| `dev`       | Development environment                                                                            | `localhost`            |
| `dev-live`  | Development environment with enabled live reloading/rebuilding usefully to develop the application | `localhost`            |

To specify an environment, you can extend the docker-compose command with the `-f` flag, specifying an additional
docker-compose file.

For example, to launch the `dev` environment, you can use the following command:

```bash
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.dev.yml up [--build]
```

::: info
`--build` is optional and forces docker to rebuild the containers.
:::

## Domain Binding - Running on Localhost

Depending on the environment, you must set the environment variable `DOMAIN` to `localhost` if you want to run the
application on your local machine. Setting the environment variable `DOMAIN` to `localhost` will cause the application
to bind to `localhost` instead of the default domain binding listed above.

Alternatively, you can force the application to bind to a specific domain by setting the environment variable `DOMAIN`
to the domain, you want to bind to. This is useful if you want to run the application on a different domain than the
default domain binding. E.g. used to host the dev branch in `prod` mode on `dev.map.cevi.tool`.

For the `prod` environment running on localhost, you can use the following command:

```bash
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \ 
  -e DOMAIN=localhost up [--build]
```

## Production Environment

The production environment is the environment, which is used to host the application
on [map.cevi.tool](https://map.cevi.tool). You can use the following command to start the application in production
mode:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

### Configuration

The production environment is configured as follows:

#### Optimized Build

In the production environment the application runs in optimized mode, which means that the frontend
is compressed and minified.

#### Logging Level

::: warning
Not yet standardized!
:::

#### Domain Binding

If the environment variable `DOMAIN` is not set, the application will bind to `*.map.cevi.tool`.
This means that the frontend is calling `backend.map.cevi.tool` to access the backend.

::: tip
You can force the application to bind to a specific domain by setting the environment variable `DOMAIN`.
See [Domain Binding](/documentation/introduction/environment#domain-binding-running-on-localhost).
:::

#### Docker Image Tags

The docker images are tagged in the following way:

```
registry.cevi.tools/cevi/awt_{{service name}}>:latest
```

