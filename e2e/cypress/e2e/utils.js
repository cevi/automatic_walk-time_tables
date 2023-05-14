import path from "path";

export function test_and_save_download(file) {

    const downloadsFolder = Cypress.config('downloadsFolder')
    const downloadedFilename = path.join(downloadsFolder, 'Download.zip')
    cy.readFile(downloadedFilename, 'binary', {timeout: 15000})
        .should(buffer => expect(buffer.length).to.be.gt(150000));

    // unzip downloadedFilename
    const filename = file.split('/').pop();
    cy.exec('unzip ' + downloadedFilename + ' -d ' + downloadsFolder + '/' + filename +
        ' && rm -f ' + downloadedFilename);
    cy.clearCookies()

}


export function test_without_interaction(file) {
    cy.visit('/')
    cy.get('#uploader').selectFile('cypress/fixtures/' + file);

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

    cy.url({timeout: 10000}).should('contain', '/pending');
    cy.url({timeout: 60000}).should('contain', '/download');

    cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');
}

export function export_with_interaction(file) {

    // Fixed size is important for clicking on the map...
    cy.viewport(1800, 1200);
    cy.visit('/');

    cy.get('#uploader').selectFile(file);

    cy.get('#goto-step-2', {
        timeout: 10_000
    }).should('be.enabled');
    cy.get('#goto-step-2').click();

    // ********* Step 2 ***********
    // Interaction with the map
    // ****************************
    require('cypress-xpath')
    cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(($canvas) => {

        const canvas = $canvas[$canvas.length - 1];
        const wrapper = cy.wrap(canvas);

        // Zoom into the map
        for (let i = 0; i < 8; i++) {
            wrapper.click(625, 600);
        }

        cy.wait(2500)
        wrapper.click(625, 540);

        cy.wait(1000)
        wrapper.click(625, 690);

    });

    cy.wait(500)

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

    cy.url({timeout: 10000}).should('contain', '/pending');
    cy.url({timeout: 30000}).should('contain', '/download');

    cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');
}