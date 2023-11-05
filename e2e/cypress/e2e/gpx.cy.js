import {test_and_save_download, test_without_interaction} from './utils.js';

before(() => {
    cy.exec('rm -rf cypress/downloads/*');
});


it('detects server', () => {
    cy.visit('/');
    cy.get('.mat-button-wrapper').should('contain', 'So funktioniert es!');
})

describe('[Batch Test] of all GPX files', async () => {

    const gpx_files = Cypress.env('gpx_files');

    cy.wait(60_000)

    gpx_files.forEach(file => {
        it("Testing file: " + file, () => {

            test_without_interaction(file);
            test_and_save_download(file);

        });
    });

});


it('test backend availability', () => {
    const backend_domain = Cypress.env('BACKEND_DOMAIN');
    cy.visit(backend_domain, {failOnStatusCode: false});
})

