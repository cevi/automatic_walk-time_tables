import {writeFile} from 'fs';
// Configure Angular `environment.ts` file path
const targetPath = './src/environments/environment.ts';

// Load node modules
const colors = require('colors');
require('dotenv').config();

// `environment.ts` file structure
const envConfigFile = `export const environment = {
   production: ${process.env.ANGULAR_BUILD_MODE == 'production' ? 'true' : 'false'},
   API_URL: '${process.env.BACKEND_DOMAIN}/',
   VALHALLA_URL: '${process.env.VALHALLA_DOMAIN}/',
   DOCS_URL: '${process.env.DOCS_DOMAIN}/',
};
`;

console.log(colors.magenta('The file `environment.ts` will be written with the following content: \n'));
console.log(colors.grey(envConfigFile));

writeFile(targetPath, envConfigFile, function (err) {
  if (err) {
    throw console.error(err);
  } else {
    console.log(colors.magenta(`Angular environment.ts file generated correctly at ${targetPath} \n`));
  }
});
