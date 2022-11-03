"use strict";
exports.__esModule = true;
var fs_1 = require("fs");
// Configure Angular `environment.ts` file path
var targetPath = './src/environments/environment.ts';
// Load node modules
var colors = require('colors');
require('dotenv').load();
// `environment.ts` file structure
var envConfigFile = "export const environment = {\n   production: " + (process.env.ANGULAR_BUILD_MODE == 'production' ? 'true' : 'false') + ",\n   API_URL: '" + process.env.BACKEND_DOMAIN + "/',\n};\n";
console.log(colors.magenta('The file `environment.ts` will be written with the following content: \n'));
console.log(colors.grey(envConfigFile));
fs_1.writeFile(targetPath, envConfigFile, function (err) {
    if (err) {
        throw console.error(err);
    }
    else {
        console.log(colors.magenta("Angular environment.ts file generated correctly at " + targetPath + " \n"));
    }
});
