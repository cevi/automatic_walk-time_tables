const path = require("path");

it('detects server', () => {
    cy.visit('/');

    cy.get('.mat-button-wrapper').should('contain', 'So funktioniert es!');
})

it('Test small KML file without change', () => {
    cy.visit('/')
    cy.get('#uploader').selectFile("cypress/fixtures/test_small.kml");
    cy.get('#goto-step-2', {
        timeout: 10_000
    }).should('be.enabled');
    cy.get('#goto-step-2').click();
    cy.get('#goto-step-3').click();
    cy.get('#goto-step-4').click();
    cy.get('#goto-step-5').click();

    cy.get('#export-button', {
        timeout: 10_000
    }).should('be.enabled');
    cy.get('#export-button').click();

    cy.url({ timeout: 10000 }).should('contain', '/pending');
    cy.url({ timeout: 60000 }).should('contain', '/download');

    cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');

    const downloadsFolder = Cypress.config('downloadsFolder')
    const downloadedFilename = path.join(downloadsFolder, 'Download.zip')
    cy.readFile(downloadedFilename, 'binary', { timeout: 15000 })
        .should(buffer => expect(buffer.length).to.be.gt(1500000));

    cy.wait(2000);
})

it('Test small KML file with UI change', () => {
    cy.visit('/');
    cy.get('#uploader').selectFile("cypress/fixtures/test_small.kml");
    cy.get('#goto-step-2', {
        timeout: 10_000
    }).should('be.enabled');
    cy.get('#goto-step-2').click();
    cy.get('#goto-step-3').click();
    cy.get('[formControlName="create-map-pdfs"]').click(); // no map

    // check if unchecked 
    cy.get('#mat-slide-toggle-1-input').should('not.be.checked');

    cy.get('#goto-step-4').click();
    cy.get('#goto-step-5').click();
    cy.get('#export-button', {
        timeout: 10_000
    }).should('be.enabled');
    cy.get('#export-button').click();

    cy.url({ timeout: 10000 }).should('contain', '/pending');
    cy.url({ timeout: 30000 }).should('contain', '/download');

    cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');

    const downloadsFolder = Cypress.config('downloadsFolder')
    const downloadedFilename = path.join(downloadsFolder, 'Download.zip')
    cy.readFile(downloadedFilename, 'binary', { timeout: 15000 })
        .should(buffer => expect(buffer.length).to.be.gt(100).to.be.lt(1500000));

    cy.wait(2000);
})

it('test backend availability', () => {
    cy.visit("http://awt-backend:5000", { failOnStatusCode: false });
})