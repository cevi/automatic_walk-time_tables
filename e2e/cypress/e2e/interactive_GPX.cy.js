import {export_with_interaction, test_and_save_download, test_without_interaction} from './utils.js';


it('Test small GPX file with UI change', () => {

    const file = "cypress/fixtures/test_small.gpx";
    export_with_interaction(file);
    test_and_save_download(file);

})

