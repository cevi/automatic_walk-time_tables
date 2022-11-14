const { defineConfig } = require('cypress');

module.exports = defineConfig({
  "chromeWebSecurity": false,
  "pageLoadTimeout": 60_000,
  "video": false,
  e2e: {

  }
});