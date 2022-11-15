# Testing

The application is tested using `cypress`. Make sure to include the `cypress` container with

```bash
docker-compose -f docker-compose.yml -f docker-compose.ci-testing.yml up --build --exit-code-from awt-cypress
```

At boot, this container will run the `cypress` tests.

## Run Cypress Locally to Develop Tests Cases

Navigate to the `e2e` folder and run

```bash
npm install
```

to install the dependencies.

Then, run

```bash
npm run cypress:open
```

to open the Cypress GUI. From there, you can run the tests or develop new ones.