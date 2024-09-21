import {test_without_interaction, test_and_save_download} from './utils.js';

before(() => {
    cy.exec('rm -rf cypress/downloads/*');
});


it('Test small GPX file with UI change', () => {

    const file = "cypress/fixtures/test_small.gpx";
    test_without_interaction(file);
    cy.location("pathname").should('contain', "download");

    cy.location("pathname").should((path) => {
        path.split("/").slice(1).as("uuid")
    })

    cy.visit('/retrieve/@uuid')
    cy.url({timeout: 10_000}).should('contain', '/pending');
    cy.url({timeout: 180_000}).should('contain', '/download');
    cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');

    test_and_save_download(file);
    
})

