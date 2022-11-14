# Testing

The application is tested using `cypress`. Make sure to include the `cypress` container with

```bash
docker-compose -f docker-compose.yml -f docker-compose.interactive-testing.yml up -d
```

At boot, this container will run the `cypress` tests. Test results are available at `http://localhost:3000`.