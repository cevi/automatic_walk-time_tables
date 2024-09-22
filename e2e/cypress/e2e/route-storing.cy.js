import {test_without_interaction, test_and_save_download} from './utils.js';

before(() => {
    cy.exec('rm -rf cypress/downloads/*');
});


it('Test small GPX file with UI change', () => {

    const gpx_files = Cypress.env('gpx_files');

    const file = gpx_files[0]; // take first gpx_file to perform route-storing test
    test_without_interaction(file);
    cy.location("pathname").should('contain', "download");

    cy.location("pathname").then((path) => {
        const uuid = path.split("/")[1];
        cy.visit(`/retrieve/${uuid}`)
    })

    cy.url({timeout: 10_000}).should('contain', '/pending');
    cy.url({timeout: 180_000}).should('contain', '/download');
    cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');

    test_and_save_download(file);
    
})

