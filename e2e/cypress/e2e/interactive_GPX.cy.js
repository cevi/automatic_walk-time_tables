import {export_with_interaction, test_and_save_download} from './utils.js';

before(() => {
    cy.exec('rm -rf cypress/downloads/*');
});


it('Test small GPX file with UI change', () => {

    const file = "cypress/fixtures/test_small.gpx";
    export_with_interaction(file);
    test_and_save_download(file);

})

