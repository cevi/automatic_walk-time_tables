const {defineConfig} = require("cypress");
const fs = require('fs')
const { rmdir } = require('fs')

const getFiles = (path) => {
    return fs.readdirSync(`${__dirname}/${path}`)
}

module.exports = defineConfig({
    "chromeWebSecurity": false,
    "pageLoadTimeout": 60_000,
    "video": false,
    e2e: {
        setupNodeEvents(on, config) {
            config.env.gpx_files = getFiles('cypress/fixtures/').filter(file => file.endsWith('.gpx'));
            config.env.kml_files = getFiles('cypress/fixtures/').filter(file => file.endsWith('.kml'));
            return config
        }
    },
});