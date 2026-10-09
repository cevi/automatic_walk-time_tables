const { defineConfig } = require("cypress");
const fs = require("fs");
const { rmdir } = require("fs");

require("dotenv").config();

const getFiles = (path) => {
  return fs.readdirSync(`${__dirname}/${path}`);
};

module.exports = defineConfig({
  chromeWebSecurity: false,
  pageLoadTimeout: 90_000,
  video: false,
  allowCypressEnv: false,
  e2e: {
    setupNodeEvents(on, config) {
      config.expose = {
        gpx_files: getFiles("cypress/fixtures/").filter((file) =>
          file.endsWith(".gpx"),
        ),
        kml_files: getFiles("cypress/fixtures/").filter((file) =>
          file.endsWith(".kml"),
        ),
        BACKEND_DOMAIN: process.env.BACKEND_DOMAIN || "http://localhost:5000",
      };
      return config;
    },
  },
});
