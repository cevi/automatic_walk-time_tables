# Automatic Walk-Time Tables: Webinterface

For development, you can run the following commands.

1) Install node Version 14, e.g. by using the [Node Version Manager](https://github.com/nvm-sh/nvm).

3) Launch the application by running:
```bash
$ npm install
$ npm start
```

The application can be run inside a Docker container:

```bash
$ docker build . -t cevi/walktable_webinterface:latest
$ docker run --publish=80:80  cevi/walktable_webinterface:latest
```
